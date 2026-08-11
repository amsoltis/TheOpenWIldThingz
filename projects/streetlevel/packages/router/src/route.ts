import type { LineID, ServiceAlert, StationID } from '@streetlevel/shared';
import { getIndex, type ServicePeriod, type TrackEdge } from '@streetlevel/data';

import { MinHeap } from './heap.js';
import {
  DEFAULT_BOARDING_WAIT_SECONDS,
  DEFAULT_TRANSFER_PENALTY_SECONDS,
  type DivertedContext,
  type RideLeg,
  type RouteLeg,
  type RoutePlan,
  type RoutingOptions,
} from './types.js';

/**
 * Search state is (station, line) rather than just station.
 *
 * Routing on bare stations cannot tell "stay on the 4 train" apart from "get
 * off the 4 and board the 5", so it silently produces plans with transfers the
 * traveller was never told about. Carrying the boarded line in the state is
 * what makes a transfer an explicit, priced decision.
 */
type StateKey = string; // `${stationId}|${line}` — `|BOARD` for the pre-boarding state

const BOARD_STATE = 'BOARD';

function stateKey(station: StationID, line: string): StateKey {
  return `${station}|${line}`;
}

interface Predecessor {
  fromKey: StateKey;
  kind: 'RIDE' | 'TRANSFER' | 'BOARD';
  line?: LineID;
  seconds: number;
}

/**
 * The service period in force at a given moment, in New York local time.
 *
 * Deliberately computed with `Intl` rather than the host's local clock: the
 * server may well be running in another timezone, and getting this wrong means
 * routing a rider onto the overnight timetable in the middle of the afternoon.
 */
export function activeServicePeriod(at: Date): ServicePeriod {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(at);

  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '12';
  const weekdayPart = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(hourPart) % 24;

  if (hour >= 0 && hour < 6) return 'LATE_NIGHT';
  return weekdayPart === 'Sat' || weekdayPart === 'Sun' ? 'WEEKEND' : 'WEEKDAY';
}

/**
 * Scheduled trips a hop needs in a period before the router will use it.
 *
 * One or two trips is a scheduling artefact — a single put-in run, or a
 * rush-hour extra that will not be there when the traveller arrives. Requiring
 * a handful keeps the plan to service that reliably exists.
 */
export const MIN_TRIPS_FOR_REGULAR_SERVICE = 4;

export function edgeRunsDuring(edge: TrackEdge, period: ServicePeriod): boolean {
  const count =
    period === 'LATE_NIGHT'
      ? edge.service.lateNight
      : period === 'WEEKEND'
        ? edge.service.weekend
        : edge.service.weekday;
  return count >= MIN_TRIPS_FOR_REGULAR_SERVICE;
}

/** Lines with trains actually leaving this station during this period. */
export function linesRunningAt(station: StationID, period: ServicePeriod): LineID[] {
  const index = getIndex();
  const lines = new Set<LineID>();
  for (const edge of index.edgesFrom.get(station) ?? []) {
    if (edgeRunsDuring(edge, period)) lines.add(edge.line);
  }
  return [...lines];
}

/**
 * Works out which alerts bite at the moment of travel.
 *
 * This is the Predictive Divergence Engine's core: the same origin and
 * destination routed for 2pm and for 1am are two different graphs, because
 * overnight track work removes lines from the second one.
 */
export function resolveDisruptions(at: Date, alerts: ServiceAlert[] = []): DivertedContext {
  const blockedLines = new Set<LineID>();
  const blockedStations = new Set<StationID>();
  const active: ServiceAlert[] = [];
  const t = at.getTime();

  for (const alert of alerts) {
    const from = Date.parse(alert.activeFrom);
    const until = Date.parse(alert.activeUntil);
    if (Number.isNaN(from) || Number.isNaN(until)) continue;
    if (t < from || t > until) continue;
    active.push(alert);

    if (alert.effect === 'NO_SERVICE' || alert.effect === 'DETOUR') {
      for (const line of alert.affectedLineIds) blockedLines.add(line);
    }
    if (alert.effect === 'STATION_BYPASS' || alert.effect === 'NO_SERVICE') {
      for (const station of alert.affectedStationIds) blockedStations.add(station);
    }
  }
  return { blockedLines, blockedStations, alerts: active };
}

export function planRoute(
  originStationId: StationID,
  destinationStationId: StationID,
  options: RoutingOptions,
): RoutePlan | null {
  const index = getIndex();
  const transferPenalty = options.transferPenaltySeconds ?? DEFAULT_TRANSFER_PENALTY_SECONDS;
  const boardingWait = options.boardingWaitSeconds ?? DEFAULT_BOARDING_WAIT_SECONDS;
  const maxTransfers = options.maxTransfers ?? 4;
  const period = activeServicePeriod(options.at);
  const disruptions = resolveDisruptions(options.at, options.alerts);

  const destinationStation = index.stations[destinationStationId];
  if (!index.stations[originStationId] || !destinationStation) return null;

  /**
   * Arriving anywhere in the destination's complex counts as arriving.
   *
   * The MTA models each platform group as its own station, so "Myrtle-Wyckoff
   * Avs" is two stations — one on the L, one on the M — joined by a passage.
   * Targeting only the exact id makes the router declare no route whenever the
   * traveller's line happens to serve the sibling platform, which is both wrong
   * and, during a suspension, wrong at the worst possible moment.
   */
  const goalStations = new Set(
    index.complexMembers.get(destinationStation.complexId) ?? [destinationStationId],
  );

  if (originStationId === destinationStationId) {
    return {
      originStationId,
      destinationStationId,
      legs: [],
      totalSeconds: 0,
      transferCount: 0,
      divertedAroundLines: [],
      servicePeriod: period,
    };
  }

  const dist = new Map<StateKey, number>();
  const prev = new Map<StateKey, Predecessor>();
  const transfersUsed = new Map<StateKey, number>();
  const heap = new MinHeap<StateKey>();

  const startKey = stateKey(originStationId, BOARD_STATE);
  dist.set(startKey, 0);
  transfersUsed.set(startKey, 0);
  heap.push(startKey, 0);

  const settled = new Set<StateKey>();
  let bestGoalKey: StateKey | null = null;

  const relax = (
    fromKey: StateKey,
    toKey: StateKey,
    cost: number,
    pred: Predecessor,
    transfers: number,
  ) => {
    const base = dist.get(fromKey);
    if (base === undefined) return;
    const next = base + cost;
    const known = dist.get(toKey);
    if (known !== undefined && known <= next) return;
    dist.set(toKey, next);
    prev.set(toKey, pred);
    transfersUsed.set(toKey, transfers);
    heap.push(toKey, next);
  };

  while (heap.size > 0) {
    const current = heap.pop();
    if (!current) break;
    const { value: key } = current;
    if (settled.has(key)) continue;
    settled.add(key);

    const sep = key.lastIndexOf('|');
    const station = key.slice(0, sep);
    const line = key.slice(sep + 1);
    const usedTransfers = transfersUsed.get(key) ?? 0;

    if (goalStations.has(station) && line !== BOARD_STATE) {
      bestGoalKey = key;
      break;
    }

    if (line === BOARD_STATE) {
      for (const candidate of linesRunningAt(station, period)) {
        if (disruptions.blockedLines.has(candidate)) continue;
        relax(
          key,
          stateKey(station, candidate),
          boardingWait,
          { fromKey: key, kind: 'BOARD', line: candidate, seconds: boardingWait },
          usedTransfers,
        );
      }
      // Walking to a sibling platform before boarding anything is free of the
      // transfer penalty — the traveller has not got on a train yet.
      for (const transfer of index.transfersFrom.get(station) ?? []) {
        if (disruptions.blockedStations.has(transfer.to)) continue;
        relax(
          key,
          stateKey(transfer.to, BOARD_STATE),
          transfer.seconds,
          { fromKey: key, kind: 'TRANSFER', seconds: transfer.seconds },
          usedTransfers,
        );
      }
      continue;
    }

    const boardedLine = line as LineID;

    // Stay on the train.
    for (const edge of index.edgesFrom.get(station) ?? []) {
      if (edge.line !== boardedLine) continue;
      if (!edgeRunsDuring(edge, period)) continue;
      if (disruptions.blockedLines.has(edge.line)) continue;
      if (disruptions.blockedStations.has(edge.to)) continue;
      relax(
        key,
        stateKey(edge.to, boardedLine),
        edge.seconds,
        { fromKey: key, kind: 'RIDE', line: boardedLine, seconds: edge.seconds },
        usedTransfers,
      );
    }

    if (usedTransfers >= maxTransfers) continue;

    // Change to another line on this platform / in this station.
    for (const candidate of linesRunningAt(station, period)) {
      if (candidate === boardedLine || disruptions.blockedLines.has(candidate)) continue;
      const cost = transferPenalty + boardingWait;
      relax(
        key,
        stateKey(station, candidate),
        cost,
        { fromKey: key, kind: 'TRANSFER', line: candidate, seconds: cost },
        usedTransfers + 1,
      );
    }

    // Walk to another station in the same complex and board there.
    for (const transfer of index.transfersFrom.get(station) ?? []) {
      if (disruptions.blockedStations.has(transfer.to)) continue;
      for (const candidate of linesRunningAt(transfer.to, period)) {
        if (disruptions.blockedLines.has(candidate)) continue;
        if (candidate === boardedLine && transfer.to === station) continue;
        const cost = transfer.seconds + transferPenalty + boardingWait;
        relax(
          key,
          stateKey(transfer.to, candidate),
          cost,
          { fromKey: key, kind: 'TRANSFER', line: candidate, seconds: cost },
          usedTransfers + 1,
        );
      }
    }
  }

  if (!bestGoalKey) return null;

  // Report the platform actually arrived at, which may be a sibling of the one
  // that was asked for.
  const arrivedAt = bestGoalKey.slice(0, bestGoalKey.lastIndexOf('|'));
  return reconstruct(originStationId, arrivedAt, bestGoalKey, prev, dist, disruptions, period);
}

function reconstruct(
  originStationId: StationID,
  destinationStationId: StationID,
  goalKey: StateKey,
  prev: Map<StateKey, Predecessor>,
  dist: Map<StateKey, number>,
  disruptions: DivertedContext,
  period: ServicePeriod,
): RoutePlan {
  const index = getIndex();

  interface Step {
    kind: 'RIDE' | 'TRANSFER' | 'BOARD';
    line?: LineID;
    fromStation: StationID;
    toStation: StationID;
    seconds: number;
  }

  const steps: Step[] = [];
  let key: StateKey | undefined = goalKey;
  while (key) {
    const pred: Predecessor | undefined = prev.get(key);
    if (!pred) break;
    const sep = key.lastIndexOf('|');
    const toStation = key.slice(0, sep);
    const fromSep = pred.fromKey.lastIndexOf('|');
    const fromStation = pred.fromKey.slice(0, fromSep);
    steps.push({ kind: pred.kind, line: pred.line, fromStation, toStation, seconds: pred.seconds });
    key = pred.fromKey;
  }
  steps.reverse();

  const findEdge = (from: StationID, to: StationID, line: LineID): TrackEdge | undefined =>
    (index.edgesFrom.get(from) ?? []).find((e) => e.to === to && e.line === line);

  // Collapse consecutive RIDE steps on one line into a single leg — that is one
  // instruction to the traveller ("ride five stops"), not five.
  const legs: RouteLeg[] = [];
  let pendingRide: { line: LineID; stations: StationID[]; seconds: number } | null = null;

  const flushRide = () => {
    const ride = pendingRide;
    pendingRide = null;
    if (!ride || ride.stations.length < 2) return;

    const from = ride.stations[0]!;
    const to = ride.stations.at(-1)!;

    // Direction and headsign come from the edges themselves, so they describe
    // the train that actually makes this hop rather than the line in general.
    const firstEdge = findEdge(from, ride.stations[1]!, ride.line);
    const passes: Record<StationID, string[]> = {};
    for (let i = 0; i < ride.stations.length - 1; i++) {
      const a = ride.stations[i]!;
      const edge = findEdge(a, ride.stations[i + 1]!, ride.line);
      if (edge && edge.passesWithoutStopping.length > 0) passes[a] = edge.passesWithoutStopping;
    }

    const leg: RideLeg = {
      kind: 'RIDE',
      line: ride.line,
      from,
      to,
      stations: [...ride.stations],
      seconds: ride.seconds,
      direction: firstEdge?.direction ?? 'N',
      headsign: firstEdge?.headsign ?? index.stations[to]?.name ?? '',
      passesWithoutStopping: passes,
    };
    legs.push(leg);
  };

  for (const step of steps) {
    if (step.kind === 'RIDE' && step.line) {
      if (pendingRide && pendingRide.line === step.line) {
        pendingRide.stations.push(step.toStation);
        pendingRide.seconds += step.seconds;
      } else {
        flushRide();
        pendingRide = { line: step.line, stations: [step.fromStation, step.toStation], seconds: step.seconds };
      }
      continue;
    }

    // The wait before the first train is folded into the leg that follows it.
    if (step.kind === 'BOARD') continue;

    flushRide();
    if (step.fromStation !== step.toStation) {
      legs.push({ kind: 'TRANSFER', from: step.fromStation, to: step.toStation, seconds: step.seconds, inPlace: false });
    } else if (legs.length > 0) {
      legs.push({ kind: 'TRANSFER', from: step.fromStation, to: step.toStation, seconds: step.seconds, inPlace: true });
    }
  }
  flushRide();

  // A transfer at either end is an artefact of the search, not something the
  // traveller does: they walk in off the street and out onto it.
  while (legs.length > 0 && legs[0]!.kind === 'TRANSFER') legs.shift();
  while (legs.length > 0 && legs.at(-1)!.kind === 'TRANSFER') legs.pop();

  return {
    originStationId,
    destinationStationId,
    legs,
    totalSeconds: dist.get(goalKey) ?? 0,
    transferCount: legs.filter((l) => l.kind === 'TRANSFER').length,
    divertedAroundLines: [...disruptions.blockedLines],
    servicePeriod: period,
  };
}
