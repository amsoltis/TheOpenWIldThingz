import type { StationID } from '@streetlevel/shared';
import {
  type GeocodeResult,
  type Geocoder,
  type LatLon,
  getStation,
  nearestStationComplexes,
  walkingMinutes,
} from '@streetlevel/data';

import { planRoute } from './route.js';
import type { RoutePlan, RoutingOptions } from './types.js';

export interface TripPlan {
  origin: GeocodeResult;
  destination: GeocodeResult;
  boardStationId: StationID;
  alightStationId: StationID;
  /** Street walk from the origin address to the station entrance. */
  walkToStationMinutes: number;
  /** Street walk from the exit staircase to the destination door. */
  walkFromStationMinutes: number;
  route: RoutePlan;
  totalMinutes: number;
}

export class NoRouteFoundError extends Error {
  constructor(
    message: string,
    readonly reason: 'ORIGIN_NOT_FOUND' | 'DESTINATION_NOT_FOUND' | 'NO_PATH' | 'WALK_INSTEAD',
  ) {
    super(message);
    this.name = 'NoRouteFoundError';
  }
}

/**
 * Below this, taking the subway is worse advice than walking — you would spend
 * longer underground finding the platform than you would on the pavement.
 * Telling a tourist to ride one stop is how you lose their trust.
 */
export const MIN_WORTHWHILE_RIDE_MINUTES = 8;

export interface PlanTripOptions extends RoutingOptions {
  geocoder: Geocoder;
  /** How many nearby station complexes to try at each end. */
  candidatesPerEnd?: number;
}

export async function planTrip(
  originAddress: string,
  destinationAddress: string,
  options: PlanTripOptions,
): Promise<TripPlan> {
  const [origin, destination] = await Promise.all([
    options.geocoder.geocode(originAddress),
    options.geocoder.geocode(destinationAddress),
  ]);

  if (!origin) {
    throw new NoRouteFoundError(`Could not place "${originAddress}" in New York City.`, 'ORIGIN_NOT_FOUND');
  }
  if (!destination) {
    throw new NoRouteFoundError(`Could not place "${destinationAddress}" in New York City.`, 'DESTINATION_NOT_FOUND');
  }

  const candidates = options.candidatesPerEnd ?? 3;
  const boardOptions = nearestStationComplexes(origin.point, candidates);
  const alightOptions = nearestStationComplexes(destination.point, candidates);

  if (boardOptions.length === 0 || alightOptions.length === 0) {
    throw new NoRouteFoundError('No subway station within reach of one end of this trip.', 'NO_PATH');
  }

  const directWalk = walkingMinutes(origin.point, destination.point);

  let best: TripPlan | null = null;
  for (const board of boardOptions) {
    for (const alight of alightOptions) {
      if (board.station.id === alight.station.id) continue;
      const route = planRoute(board.station.id, alight.station.id, options);
      if (!route || route.legs.length === 0) continue;

      const walkTo = walkingMinutes(origin.point, board.station);
      const walkFrom = walkingMinutes(alight.station, destination.point);
      const totalMinutes = walkTo + walkFrom + route.totalSeconds / 60;

      if (!best || totalMinutes < best.totalMinutes) {
        best = {
          origin,
          destination,
          boardStationId: board.station.id,
          alightStationId: alight.station.id,
          walkToStationMinutes: walkTo,
          walkFromStationMinutes: walkFrom,
          route,
          totalMinutes,
        };
      }
    }
  }

  if (!best) {
    throw new NoRouteFoundError('No subway path connects these two places.', 'NO_PATH');
  }

  best = reanchorToRideEnds(best, origin.point, destination.point);

  // Honest answer beats a technically-valid one: if the walk is comparable,
  // say so rather than sending someone underground for nothing.
  if (directWalk <= MIN_WORTHWHILE_RIDE_MINUTES || directWalk <= best.totalMinutes) {
    throw new NoRouteFoundError(
      `That is about a ${Math.round(directWalk)} minute walk — faster than going underground.`,
      'WALK_INSTEAD',
    );
  }

  return best;
}

/**
 * Re-points the trip at the stations the traveller actually boards and leaves
 * from.
 *
 * Candidate stations are chosen one per complex, so the nearest member of the
 * Times Square complex might be the shuttle platform while the plan actually
 * puts you on a 3 two levels away. Left uncorrected, the entrance card would
 * name a staircase for a line the traveller never boards — the single most
 * disorienting thing this app could tell someone at street level.
 *
 * Walking times are recomputed against the real endpoints. In-complex walking
 * already priced into the route is left in place, so the estimate errs long.
 */
function reanchorToRideEnds(plan: TripPlan, originPoint: LatLon, destinationPoint: LatLon): TripPlan {
  const rides = plan.route.legs.filter((l) => l.kind === 'RIDE');
  const first = rides[0];
  const last = rides.at(-1);
  if (!first || !last || first.kind !== 'RIDE' || last.kind !== 'RIDE') return plan;

  const boardStation = getStation(first.from);
  const alightStation = getStation(last.to);
  if (!boardStation || !alightStation) return plan;

  return {
    ...plan,
    boardStationId: first.from,
    alightStationId: last.to,
    walkToStationMinutes: walkingMinutes(originPoint, boardStation),
    walkFromStationMinutes: walkingMinutes(alightStation, destinationPoint),
  };
}

/**
 * Plans from a station the traveller is already standing in.
 *
 * Used by the recovery flow. Deliberately skips the "is walking faster?" check
 * that `planTrip` applies: someone who has just realised they are lost
 * underground wants to be told what to do from where they are, not advised to
 * go back up to the street and walk.
 */
export async function planTripFromStation(
  stationId: StationID,
  destinationAddress: string,
  options: PlanTripOptions,
): Promise<TripPlan> {
  const station = getStation(stationId);
  if (!station) {
    throw new NoRouteFoundError(`Unknown station ${stationId}.`, 'ORIGIN_NOT_FOUND');
  }

  const destination = await options.geocoder.geocode(destinationAddress);
  if (!destination) {
    throw new NoRouteFoundError(
      `Could not place "${destinationAddress}" in New York City.`,
      'DESTINATION_NOT_FOUND',
    );
  }

  const alightOptions = nearestStationComplexes(destination.point, options.candidatesPerEnd ?? 3);
  let best: TripPlan | null = null;

  for (const alight of alightOptions) {
    if (alight.station.id === stationId) continue;
    const route = planRoute(stationId, alight.station.id, options);
    if (!route || route.legs.length === 0) continue;
    const walkFrom = walkingMinutes(alight.station, destination.point);
    const totalMinutes = walkFrom + route.totalSeconds / 60;
    if (!best || totalMinutes < best.totalMinutes) {
      best = {
        origin: {
          query: station.name,
          label: station.name,
          point: { latitude: station.latitude, longitude: station.longitude },
          source: 'GAZETTEER',
          confidence: 1,
        },
        destination,
        boardStationId: stationId,
        alightStationId: alight.station.id,
        walkToStationMinutes: 0,
        walkFromStationMinutes: walkFrom,
        route,
        totalMinutes,
      };
    }
  }

  if (!best) {
    throw new NoRouteFoundError(
      `No subway route from ${station.name} to ${destination.label}.`,
      'NO_PATH',
    );
  }
  // The traveller is standing at `stationId`, so only the far end may move.
  const reanchored = reanchorToRideEnds(best, best.origin.point, destination.point);
  return { ...reanchored, boardStationId: stationId, walkToStationMinutes: 0 };
}

export function midpoint(a: LatLon, b: LatLon): LatLon {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
  };
}
