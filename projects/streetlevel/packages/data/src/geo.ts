import type { BoroughCode } from './types.js';

export interface LatLon {
  latitude: number;
  longitude: number;
}

/** The geofence the offline map layer pre-caches, and the sanity bound on any
 *  coordinate the shaper produces. */
export const NYC_BOUNDING_BOX = {
  minLatitude: 40.4,
  maxLatitude: 41.0,
  minLongitude: -74.3,
  maxLongitude: -73.6,
} as const;

export function isWithinServiceArea(p: LatLon): boolean {
  return (
    p.latitude >= NYC_BOUNDING_BOX.minLatitude &&
    p.latitude <= NYC_BOUNDING_BOX.maxLatitude &&
    p.longitude >= NYC_BOUNDING_BOX.minLongitude &&
    p.longitude <= NYC_BOUNDING_BOX.maxLongitude
  );
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Unhurried pace, allowing for crowds and traffic lights. Deliberately slower
 *  than a routing engine's default: a tourist with luggage is not a commuter. */
export const WALKING_METERS_PER_MINUTE = 72;

export function walkingMinutes(a: LatLon, b: LatLon): number {
  return haversineMeters(a, b) / WALKING_METERS_PER_MINUTE;
}

/* ------------------------------------------------------------------ *
 * Borough classification
 *
 * The GTFS feed does not carry a borough field, so it is inferred from
 * coordinates. Manhattan is tested as an explicit polygon because its northern
 * tip (Inwood, Marble Hill) sits further north and east than a naive latitude
 * cut would allow, and would otherwise land in the Bronx. `test/geo.test.ts`
 * pins this against known stations at each borough edge.
 * ------------------------------------------------------------------ */

type Ring = readonly (readonly [number, number])[]; // [lon, lat]

const MANHATTAN: Ring = [
  [-74.019, 40.701], [-74.014, 40.726], [-74.010, 40.745], [-74.008, 40.756],
  [-73.995, 40.774], [-73.985, 40.793], [-73.975, 40.812], [-73.962, 40.830],
  [-73.950, 40.849], [-73.935, 40.867], [-73.918, 40.882], [-73.902, 40.876],
  [-73.911, 40.860], [-73.921, 40.845], [-73.930, 40.831], [-73.934, 40.814],
  [-73.929, 40.797], [-73.938, 40.783], [-73.941, 40.769], [-73.946, 40.756],
  [-73.964, 40.744], [-73.970, 40.734], [-73.972, 40.723], [-73.978, 40.711],
  [-73.997, 40.703],
];

// Traced wide enough to hold the two peninsulas that a tidy outline clips off:
// Bay Ridge in the west and Coney Island in the south.
const BROOKLYN: Ring = [
  [-74.045, 40.635], [-74.035, 40.655], [-74.022, 40.682], [-74.020, 40.700],
  [-73.990, 40.725], [-73.960, 40.740], [-73.930, 40.727], [-73.900, 40.712],
  [-73.855, 40.695], [-73.850, 40.640], [-73.900, 40.600], [-73.940, 40.568],
  [-74.000, 40.570],
];

/** Ray casting. Points exactly on an edge are not meaningfully possible here —
 *  station coordinates are metres inside a borough, not on its shoreline. */
function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i]!;
    const pj = ring[j]!;
    const [xi, yi] = pi;
    const [xj, yj] = pj;
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function boroughFor(p: LatLon): BoroughCode {
  const { latitude: lat, longitude: lon } = p;
  if (pointInRing(lon, lat, MANHATTAN)) return 'M';
  // Only the Bronx reaches this far north once Manhattan is excluded.
  if (lat >= 40.785) return 'X';
  if (lon <= -74.05) return 'SI';
  if (pointInRing(lon, lat, BROOKLYN)) return 'B';
  return 'Q';
}

export const BOROUGH_NAMES: Record<BoroughCode, string> = {
  M: 'Manhattan',
  B: 'Brooklyn',
  Q: 'Queens',
  X: 'the Bronx',
  SI: 'Staten Island',
};

/**
 * Which corner of an intersection a point sits on, relative to the crossing
 * itself. Compass directions are stripped from traveller-facing copy, but the
 * corner code is still how the entrance data is keyed.
 */
export function cornerCodeFor(point: LatLon, intersection: LatLon): 'NW' | 'NE' | 'SW' | 'SE' {
  const northOf = point.latitude >= intersection.latitude;
  const eastOf = point.longitude >= intersection.longitude;
  if (northOf) return eastOf ? 'NE' : 'NW';
  return eastOf ? 'SE' : 'SW';
}
