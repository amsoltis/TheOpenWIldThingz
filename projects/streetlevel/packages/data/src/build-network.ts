import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';

import type { LineID, StationID } from '@streetlevel/shared';
import { normaliseGtfsRouteId } from '@streetlevel/shared';

import { gtfsTimeToSeconds, headerIndex, parseCsv, parseCsvLine } from './csv.js';
import { boroughFor } from './geo.js';
import { loadPathwayDataset } from './pathways.js';
import type {
  DirectionCode,
  LinePattern,
  StationNode,
  SubwayNetwork,
  TrackEdge,
  TransferEdge,
} from './types.js';

export const GTFS_SOURCE_URL = 'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

/** Union-find over the in-system transfer graph, so every platform you can walk
 *  between without exiting the fare gates lands in one complex. */
class DisjointSet {
  private parent = new Map<string, string>();

  find(x: string): string {
    const p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      // Keep the lexicographically smallest id as the representative so the
      // generated dataset is stable across rebuilds.
      if (ra < rb) this.parent.set(rb, ra);
      else this.parent.set(ra, rb);
    }
  }
}

interface TripMeta {
  line: LineID;
  direction: DirectionCode;
  headsign: string;
  serviceClass: 'WEEKDAY' | 'WEEKEND';
}

interface HopAccumulator {
  durations: number[];
  direction: DirectionCode;
  headsigns: Map<string, number>;
  weekday: number;
  weekend: number;
  lateNight: number;
}

/** GTFS times run past 24:00:00 for trips that cross midnight. */
function hourOfDay(seconds: number): number {
  return Math.floor(seconds / 3600) % 24;
}

/** The overnight service pattern, when express lines drop onto local track. */
const LATE_NIGHT_START_HOUR = 0;
const LATE_NIGHT_END_HOUR = 6;

function isLateNight(seconds: number): boolean {
  const hour = hourOfDay(seconds);
  return hour >= LATE_NIGHT_START_HOUR && hour < LATE_NIGHT_END_HOUR;
}

export interface BuildOptions {
  gtfsDir: string;
  /** Emitted into the dataset so a stale build is obvious at a glance. */
  generatedAt?: string;
}

export async function buildNetwork(opts: BuildOptions): Promise<SubwayNetwork> {
  const { gtfsDir } = opts;
  const read = (f: string) => readFile(path.join(gtfsDir, f), 'utf8');

  /* --- stations ------------------------------------------------------ */
  const stopRows = parseCsv(await read('stops.txt'));
  const stations: Record<StationID, StationNode> = {};
  /** platform stop id (e.g. "101N") -> parent station id ("101") */
  const platformToParent = new Map<string, StationID>();

  for (const row of stopRows) {
    const id = row['stop_id'];
    if (!id) continue;
    const parent = row['parent_station'];
    if (parent) {
      platformToParent.set(id, parent);
      continue;
    }
    if (row['location_type'] !== '1') continue;
    const latitude = Number(row['stop_lat']);
    const longitude = Number(row['stop_lon']);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    stations[id] = {
      id,
      complexId: id,
      name: row['stop_name'] ?? id,
      borough: boroughFor({ latitude, longitude }),
      lines: [],
      latitude,
      longitude,
    };
    platformToParent.set(id, id);
  }

  /* --- trips ---------------------------------------------------------- */
  const tripRows = parseCsv(await read('trips.txt'));
  const trips = new Map<string, TripMeta>();
  for (const row of tripRows) {
    const tripId = row['trip_id'];
    const routeId = row['route_id'];
    if (!tripId || !routeId) continue;
    const line = normaliseGtfsRouteId(routeId);
    if (!line) continue; // Staten Island Railway and anything else out of scope
    // service_id is "Weekday" / "Saturday" / "Sunday", plus dated holiday
    // variants that keep the same prefix.
    const serviceId = row['service_id'] ?? '';
    trips.set(tripId, {
      line,
      direction: row['direction_id'] === '1' ? 'S' : 'N',
      headsign: row['trip_headsign'] ?? '',
      serviceClass: serviceId.startsWith('Weekday') ? 'WEEKDAY' : 'WEEKEND',
    });
  }

  /* --- stop_times (streamed: ~36 MB) ---------------------------------- */
  const hops = new Map<string, HopAccumulator>();
  const sequenceCounts = new Map<string, { count: number; stations: StationID[] }>();
  const headsignCounts = new Map<string, Map<string, number>>();

  let currentTrip: string | null = null;
  let currentMeta: TripMeta | undefined;
  let prevStation: StationID | undefined;
  let prevDeparture: number | undefined;
  let currentSequence: StationID[] = [];

  const flushTrip = () => {
    if (!currentMeta || currentSequence.length < 2) return;
    const key = `${currentMeta.line}|${currentMeta.direction}`;
    const patternKey = `${key}|${currentSequence.join('>')}`;
    const existing = sequenceCounts.get(patternKey);
    if (existing) existing.count += 1;
    else sequenceCounts.set(patternKey, { count: 1, stations: [...currentSequence] });

    if (currentMeta.headsign) {
      let counts = headsignCounts.get(key);
      if (!counts) {
        counts = new Map();
        headsignCounts.set(key, counts);
      }
      counts.set(currentMeta.headsign, (counts.get(currentMeta.headsign) ?? 0) + 1);
    }
  };

  const stopTimesStream = createReadStream(path.join(gtfsDir, 'stop_times.txt'), 'utf8');
  const rl = createInterface({ input: stopTimesStream, crlfDelay: Infinity });

  let cols: Record<string, number> | null = null;
  for await (const line of rl) {
    if (!line) continue;
    if (!cols) {
      cols = headerIndex(line);
      continue;
    }
    const values = parseCsvLine(line);
    const tripId = values[cols['trip_id']!] ?? '';
    if (tripId !== currentTrip) {
      flushTrip();
      currentTrip = tripId;
      currentMeta = trips.get(tripId);
      prevStation = undefined;
      prevDeparture = undefined;
      currentSequence = [];
    }
    if (!currentMeta) continue;

    const stopId = values[cols['stop_id']!] ?? '';
    const station = platformToParent.get(stopId);
    if (!station || !stations[station]) continue;

    const arrival = gtfsTimeToSeconds(values[cols['arrival_time']!] ?? '');
    const departure = gtfsTimeToSeconds(values[cols['departure_time']!] ?? '');

    currentSequence.push(station);
    if (!stations[station]!.lines.includes(currentMeta.line)) {
      stations[station]!.lines.push(currentMeta.line);
    }

    if (prevStation && prevDeparture !== undefined && arrival !== null && prevStation !== station) {
      const seconds = arrival - prevDeparture;
      // Guard against the handful of malformed rows and midnight rollovers.
      if (seconds > 0 && seconds < 3600) {
        const key = `${currentMeta.line}|${prevStation}|${station}`;
        let hop = hops.get(key);
        if (!hop) {
          hop = {
            durations: [],
            direction: currentMeta.direction,
            headsigns: new Map(),
            weekday: 0,
            weekend: 0,
            lateNight: 0,
          };
          hops.set(key, hop);
        }
        hop.durations.push(seconds);
        if (currentMeta.headsign) {
          hop.headsigns.set(currentMeta.headsign, (hop.headsigns.get(currentMeta.headsign) ?? 0) + 1);
        }
        if (isLateNight(prevDeparture)) hop.lateNight += 1;
        else if (currentMeta.serviceClass === 'WEEKDAY') hop.weekday += 1;
        else hop.weekend += 1;
      }
    }
    prevStation = station;
    prevDeparture = departure ?? arrival ?? prevDeparture;
  }
  flushTrip();

  /* --- dominant stopping pattern per line/direction -------------------- */
  const patterns: Record<string, Partial<Record<DirectionCode, LinePattern>>> = {};
  const bestPattern = new Map<string, { count: number; stations: StationID[] }>();
  for (const [patternKey, entry] of sequenceCounts) {
    const key = patternKey.slice(0, patternKey.indexOf('|', patternKey.indexOf('|') + 1));
    const current = bestPattern.get(key);
    // Prefer the most-run pattern; break ties toward the one that serves more
    // stations, which is the full-length version of the route.
    if (
      !current ||
      entry.count > current.count ||
      (entry.count === current.count && entry.stations.length > current.stations.length)
    ) {
      bestPattern.set(key, entry);
    }
  }
  for (const [key, entry] of bestPattern) {
    const [lineRaw, dirRaw] = key.split('|');
    const line = lineRaw as LineID;
    const direction = dirRaw as DirectionCode;
    const counts = headsignCounts.get(key);
    const headsigns = counts
      ? [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h)
      : [];
    patterns[line] ??= {};
    patterns[line]![direction] = { headsigns, stations: entry.stations };
  }

  /* --- express skip detection ----------------------------------------- */
  const passedThrough = computePassedThroughStations(patterns, stations);

  /* --- edges ----------------------------------------------------------- */
  const edges: TrackEdge[] = [];
  for (const [key, hop] of hops) {
    const [line, from, to] = key.split('|') as [LineID, StationID, StationID];
    const headsign = [...hop.headsigns.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    edges.push({
      from,
      to,
      line,
      direction: hop.direction,
      headsign,
      seconds: median(hop.durations),
      service: { weekday: hop.weekday, weekend: hop.weekend, lateNight: hop.lateNight },
      passesWithoutStopping: passedThrough.get(key) ?? [],
    });
  }
  edges.sort((a, b) => a.line.localeCompare(b.line) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  /* --- transfers & complexes ------------------------------------------ */
  const transferRows = parseCsv(await read('transfers.txt'));
  const transfers: TransferEdge[] = [];
  const complexes = new DisjointSet();
  const seenTransfer = new Set<string>();

  for (const row of transferRows) {
    const from = row['from_stop_id'];
    const to = row['to_stop_id'];
    if (!from || !to || !stations[from] || !stations[to]) continue;
    const seconds = Number(row['min_transfer_time']) || 180;
    const key = `${from}|${to}`;
    if (seenTransfer.has(key)) continue;
    seenTransfer.add(key);
    transfers.push({ from, to, seconds, inPlace: from === to });
    if (from !== to) complexes.union(from, to);
  }

  for (const station of Object.values(stations)) {
    station.complexId = complexes.find(station.id);
    station.lines.sort();
  }

  /* --- indoor navigation, when the feed carries it ---------------------- */
  // Optional by design. Every agency ships schedules; almost none ship
  // pathways yet, so its absence degrades the product to station-level
  // guidance rather than failing the build.
  const pathways = await loadPathwayDataset(gtfsDir);

  /* --- meta ------------------------------------------------------------ */
  const feedInfo = parseCsv(await read('feed_info.txt'))[0] ?? {};

  // Stations with no scheduled service in this feed would be dead ends in the
  // graph; dropping them keeps the router from ever proposing one.
  for (const [id, station] of Object.entries(stations)) {
    if (station.lines.length === 0) delete stations[id];
  }

  return {
    meta: {
      feedVersion: feedInfo['feed_version'] ?? 'unknown',
      feedStartDate: feedInfo['feed_start_date'] ?? '',
      feedEndDate: feedInfo['feed_end_date'] ?? '',
      generatedAt: opts.generatedAt ?? new Date().toISOString(),
      sourceUrl: GTFS_SOURCE_URL,
      stationCount: Object.keys(stations).length,
      edgeCount: edges.length,
    },
    stations,
    edges,
    transfers,
    patterns,
    pathways,
  };
}

/**
 * Works out which stations an express hop flies past.
 *
 * For a hop A→B on an express line, we look at the local lines sharing its
 * trunk: if a local pattern contains both A and B, everything between them on
 * that local pattern is what the traveller will watch go by through the window.
 * That is the raw material for the reassurance card — "you should see 28th St
 * fly past; if you see 34th St you are going the wrong way".
 */
function computePassedThroughStations(
  patterns: Record<string, Partial<Record<DirectionCode, LinePattern>>>,
  stations: Record<StationID, StationNode>,
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  const allPatterns: { line: LineID; direction: DirectionCode; stations: StationID[] }[] = [];
  for (const [line, dirs] of Object.entries(patterns)) {
    for (const [direction, pattern] of Object.entries(dirs)) {
      if (pattern) {
        allPatterns.push({
          line: line as LineID,
          direction: direction as DirectionCode,
          stations: pattern.stations,
        });
      }
    }
  }

  for (const pattern of allPatterns) {
    for (let i = 0; i < pattern.stations.length - 1; i++) {
      const from = pattern.stations[i]!;
      const to = pattern.stations[i + 1]!;
      const key = `${pattern.line}|${from}|${to}`;
      if (result.has(key)) continue;

      let best: string[] = [];
      for (const other of allPatterns) {
        if (other.line === pattern.line || other.direction !== pattern.direction) continue;
        const ai = other.stations.indexOf(from);
        const bi = other.stations.indexOf(to);
        if (ai === -1 || bi === -1 || bi <= ai + 1) continue;
        const between = other.stations.slice(ai + 1, bi);
        // A genuine express run skips a handful of stops. A longer gap means we
        // matched an unrelated branch, not the local twin of this hop.
        if (between.length > 0 && between.length <= 6 && (best.length === 0 || between.length < best.length)) {
          best = between;
        }
      }
      if (best.length > 0) {
        result.set(
          key,
          best.map((id) => stations[id]?.name ?? id),
        );
      }
    }
  }
  return result;
}
