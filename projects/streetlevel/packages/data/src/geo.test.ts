import { describe, expect, it } from 'vitest';

import { boroughFor, cornerCodeFor, haversineMeters, isWithinServiceArea, walkingMinutes } from './geo.js';
import { getIndex, findStationsByName, nearestStationComplexes } from './network.js';
import { GazetteerGeocoder } from './geocode.js';

/**
 * Borough is inferred from coordinates rather than read from the feed, so these
 * probes pin the awkward edges: the northern tip of Manhattan that reaches past
 * the Bronx, and the two Brooklyn peninsulas a tidy outline clips off.
 */
describe('boroughFor', () => {
  const probes: [string, { latitude: number; longitude: number }, string][] = [
    ['Times Sq', { latitude: 40.7553, longitude: -73.9871 }, 'M'],
    ['Inwood-207 St (Manhattan north tip)', { latitude: 40.868, longitude: -73.919 }, 'M'],
    ['Marble Hill (Manhattan, north of the river)', { latitude: 40.8748, longitude: -73.9099 }, 'M'],
    ['Van Cortlandt Park-242 St (Bronx)', { latitude: 40.8892, longitude: -73.8986 }, 'X'],
    ['Pelham Bay Park (Bronx)', { latitude: 40.8526, longitude: -73.8281 }, 'X'],
    ['Bay Ridge-95 St (Brooklyn west peninsula)', { latitude: 40.6161, longitude: -74.0305 }, 'B'],
    ['Coney Island (Brooklyn south peninsula)', { latitude: 40.5775, longitude: -73.9812 }, 'B'],
    ['Canarsie-Rockaway Pkwy (Brooklyn east)', { latitude: 40.6465, longitude: -73.9018 }, 'B'],
    ['Court Sq (Queens, just over the creek)', { latitude: 40.7471, longitude: -73.9454 }, 'Q'],
    ['Flushing-Main St (Queens)', { latitude: 40.7596, longitude: -73.83 }, 'Q'],
    ['Far Rockaway (Queens peninsula)', { latitude: 40.6035, longitude: -73.7554 }, 'Q'],
  ];

  for (const [name, point, expected] of probes) {
    it(`places ${name} in ${expected}`, () => {
      expect(boroughFor(point)).toBe(expected);
    });
  }
});

describe('service area', () => {
  it('accepts a NYC coordinate and rejects one elsewhere', () => {
    expect(isWithinServiceArea({ latitude: 40.75, longitude: -73.98 })).toBe(true);
    expect(isWithinServiceArea({ latitude: 51.5, longitude: -0.12 })).toBe(false);
  });
});

describe('distance', () => {
  it('measures a known Manhattan block distance sensibly', () => {
    // Times Sq to Grand Central is a little under a mile.
    const metres = haversineMeters(
      { latitude: 40.7553, longitude: -73.9871 },
      { latitude: 40.7527, longitude: -73.9772 },
    );
    expect(metres).toBeGreaterThan(700);
    expect(metres).toBeLessThan(1200);
  });

  it('walks slower than a commuter, on purpose', () => {
    const minutes = walkingMinutes(
      { latitude: 40.7553, longitude: -73.9871 },
      { latitude: 40.7527, longitude: -73.9772 },
    );
    expect(minutes).toBeGreaterThan(8);
    expect(minutes).toBeLessThan(20);
  });
});

describe('cornerCodeFor', () => {
  it('reports the quadrant relative to the intersection', () => {
    const crossing = { latitude: 40.75, longitude: -73.98 };
    expect(cornerCodeFor({ latitude: 40.751, longitude: -73.979 }, crossing)).toBe('NE');
    expect(cornerCodeFor({ latitude: 40.749, longitude: -73.981 }, crossing)).toBe('SW');
  });
});

describe('the generated station graph', () => {
  it('carries every station complex with lines and coordinates', () => {
    const index = getIndex();
    const stations = Object.values(index.stations);
    expect(stations.length).toBeGreaterThan(400);
    for (const station of stations) {
      expect(station.lines.length).toBeGreaterThan(0);
      expect(isWithinServiceArea(station)).toBe(true);
    }
  });

  it('unifies the Times Square complex across its platform groups', () => {
    const index = getIndex();
    const timesSq = findStationsByName('Times Sq-42 St')[0];
    expect(timesSq).toBeDefined();
    const members = index.complexMembers.get(timesSq!.complexId) ?? [];
    // 1/2/3, 7, S, N/Q/R/W and the A/C/E at Port Authority are one walkable complex.
    expect(members.length).toBeGreaterThanOrEqual(4);
  });

  it('records real scheduled running times', () => {
    const index = getIndex();
    for (const edge of index.network.edges) {
      expect(edge.seconds).toBeGreaterThan(0);
      expect(edge.seconds).toBeLessThan(1800);
      expect(edge.headsign.length).toBeGreaterThan(0);
    }
  });

  it('knows which stations an express hop flies past', () => {
    const index = getIndex();
    const withSkips = index.network.edges.filter((e) => e.passesWithoutStopping.length > 0);
    expect(withSkips.length).toBeGreaterThan(20);
  });
});

describe('nearestStationComplexes', () => {
  it('returns distinct complexes, not several platforms of one station', () => {
    const near = nearestStationComplexes({ latitude: 40.7553, longitude: -73.9871 }, 4);
    const complexes = new Set(near.map((n) => n.station.complexId));
    expect(complexes.size).toBe(near.length);
  });
});

describe('GazetteerGeocoder', () => {
  const geocoder = new GazetteerGeocoder();

  it('resolves a known landmark', async () => {
    const hit = await geocoder.geocode('Empire State Building');
    expect(hit?.point.latitude).toBeCloseTo(40.748, 2);
  });

  it('resolves a literal coordinate inside the service area', async () => {
    const hit = await geocoder.geocode('40.7527, -73.9772');
    expect(hit?.source).toBe('COORDINATE');
  });

  it('refuses a coordinate outside New York', async () => {
    expect(await geocoder.geocode('51.5074, -0.1278')).toBeNull();
  });

  it('returns null rather than guessing at an unknown address', async () => {
    expect(await geocoder.geocode('zzzz not a place zzzz')).toBeNull();
  });
});
