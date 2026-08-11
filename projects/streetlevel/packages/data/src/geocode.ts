import type { LatLon } from './geo.js';
import { isWithinServiceArea } from './geo.js';

export interface GeocodeResult {
  query: string;
  label: string;
  point: LatLon;
  /** How the coordinate was obtained — surfaced so a low-confidence match can
   *  be confirmed with the traveller before a whole packet is built on it. */
  source: 'COORDINATE' | 'GAZETTEER' | 'PROVIDER';
  confidence: number;
}

/**
 * Address resolution is deliberately an injected dependency.
 *
 * A production deployment plugs in a real geocoder (the city's own address
 * service, or a commercial provider) behind this interface. The bundled
 * implementation resolves literal coordinates plus a small gazetteer of
 * landmarks, which is enough to run the stack, the tests, and a demo without
 * an API key — and is not enough to ship to tourists.
 */
export interface Geocoder {
  geocode(query: string): Promise<GeocodeResult | null>;
}

/**
 * Well-known destinations, to roughly 100 m. Sufficient for choosing which
 * station complex to walk to; not sufficient for door-level directions.
 */
export const LANDMARK_GAZETTEER: Record<string, { label: string; point: LatLon }> = {
  'times square': { label: 'Times Square', point: { latitude: 40.758, longitude: -73.9855 } },
  'empire state building': { label: 'Empire State Building', point: { latitude: 40.7484, longitude: -73.9857 } },
  'grand central terminal': { label: 'Grand Central Terminal', point: { latitude: 40.7527, longitude: -73.9772 } },
  'morgan library': { label: 'The Morgan Library & Museum', point: { latitude: 40.7495, longitude: -73.9814 } },
  'rockefeller center': { label: 'Rockefeller Center', point: { latitude: 40.7587, longitude: -73.9787 } },
  'bryant park': { label: 'Bryant Park', point: { latitude: 40.7536, longitude: -73.9832 } },
  'union square': { label: 'Union Square', point: { latitude: 40.7359, longitude: -73.9911 } },
  'washington square park': { label: 'Washington Square Park', point: { latitude: 40.7308, longitude: -73.9973 } },
  'madison square garden': { label: 'Madison Square Garden', point: { latitude: 40.7505, longitude: -73.9934 } },
  'flatiron building': { label: 'Flatiron Building', point: { latitude: 40.7411, longitude: -73.9897 } },
  'the met': { label: 'The Metropolitan Museum of Art', point: { latitude: 40.7794, longitude: -73.9632 } },
  'metropolitan museum of art': { label: 'The Metropolitan Museum of Art', point: { latitude: 40.7794, longitude: -73.9632 } },
  'museum of modern art': { label: 'Museum of Modern Art', point: { latitude: 40.7614, longitude: -73.9776 } },
  'moma': { label: 'Museum of Modern Art', point: { latitude: 40.7614, longitude: -73.9776 } },
  'american museum of natural history': { label: 'American Museum of Natural History', point: { latitude: 40.7813, longitude: -73.974 } },
  'guggenheim': { label: 'Solomon R. Guggenheim Museum', point: { latitude: 40.783, longitude: -73.959 } },
  'whitney museum': { label: 'Whitney Museum of American Art', point: { latitude: 40.7396, longitude: -74.0089 } },
  'central park': { label: 'Central Park (south end)', point: { latitude: 40.7677, longitude: -73.9807 } },
  'lincoln center': { label: 'Lincoln Center', point: { latitude: 40.7725, longitude: -73.9835 } },
  'high line': { label: 'The High Line (Gansevoort St entrance)', point: { latitude: 40.7397, longitude: -74.008 } },
  'chelsea market': { label: 'Chelsea Market', point: { latitude: 40.7424, longitude: -74.0061 } },
  'little island': { label: 'Little Island', point: { latitude: 40.742, longitude: -74.011 } },
  '9/11 memorial': { label: '9/11 Memorial & Museum', point: { latitude: 40.7115, longitude: -74.0134 } },
  'one world observatory': { label: 'One World Observatory', point: { latitude: 40.7127, longitude: -74.0134 } },
  'wall street': { label: 'Wall Street', point: { latitude: 40.7069, longitude: -74.0113 } },
  'battery park': { label: 'Battery Park (Statue of Liberty ferry)', point: { latitude: 40.7033, longitude: -74.017 } },
  'statue of liberty ferry': { label: 'Statue of Liberty ferry terminal', point: { latitude: 40.7033, longitude: -74.017 } },
  'brooklyn bridge': { label: 'Brooklyn Bridge (Manhattan approach)', point: { latitude: 40.7061, longitude: -73.9969 } },
  'katz\'s delicatessen': { label: "Katz's Delicatessen", point: { latitude: 40.7223, longitude: -73.9874 } },
  'tenement museum': { label: 'Tenement Museum', point: { latitude: 40.7188, longitude: -73.99 } },
  'apollo theater': { label: 'Apollo Theater', point: { latitude: 40.8099, longitude: -73.95 } },
  'yankee stadium': { label: 'Yankee Stadium', point: { latitude: 40.8296, longitude: -73.9262 } },
  'bronx zoo': { label: 'Bronx Zoo', point: { latitude: 40.8506, longitude: -73.877 } },
  'new york botanical garden': { label: 'New York Botanical Garden', point: { latitude: 40.862, longitude: -73.88 } },
  'barclays center': { label: 'Barclays Center', point: { latitude: 40.6826, longitude: -73.9754 } },
  'prospect park': { label: 'Prospect Park', point: { latitude: 40.6602, longitude: -73.969 } },
  'brooklyn botanic garden': { label: 'Brooklyn Botanic Garden', point: { latitude: 40.668, longitude: -73.963 } },
  'dumbo': { label: 'DUMBO / Brooklyn Bridge Park', point: { latitude: 40.7033, longitude: -73.9903 } },
  'williamsburg': { label: 'Williamsburg (Bedford Av)', point: { latitude: 40.717, longitude: -73.957 } },
  'coney island': { label: 'Coney Island boardwalk', point: { latitude: 40.573, longitude: -73.98 } },
  'brighton beach': { label: 'Brighton Beach', point: { latitude: 40.5776, longitude: -73.9614 } },
  'green-wood cemetery': { label: 'Green-Wood Cemetery', point: { latitude: 40.6579, longitude: -73.994 } },
  'citi field': { label: 'Citi Field', point: { latitude: 40.7571, longitude: -73.8458 } },
  'flushing meadows': { label: 'Flushing Meadows Corona Park', point: { latitude: 40.7458, longitude: -73.8458 } },
  'astoria': { label: 'Astoria', point: { latitude: 40.7644, longitude: -73.9235 } },
  'roosevelt island tram': { label: 'Roosevelt Island Tramway', point: { latitude: 40.7614, longitude: -73.964 } },
  // Airports resolve to the transit connection a traveller actually uses, not
  // the terminal building: no subway line reaches either airport directly.
  'jfk airport': { label: 'JFK Airport (AirTrain connection at Sutphin Blvd)', point: { latitude: 40.7003, longitude: -73.8076 } },
  'jfk': { label: 'JFK Airport (AirTrain connection at Sutphin Blvd)', point: { latitude: 40.7003, longitude: -73.8076 } },
  'laguardia airport': { label: 'LaGuardia Airport (bus connection at Astoria Blvd)', point: { latitude: 40.7699, longitude: -73.9176 } },
  'lga': { label: 'LaGuardia Airport (bus connection at Astoria Blvd)', point: { latitude: 40.7699, longitude: -73.9176 } },
  'penn station': { label: 'Penn Station', point: { latitude: 40.7506, longitude: -73.9935 } },
  'port authority': { label: 'Port Authority Bus Terminal', point: { latitude: 40.7570, longitude: -73.9899 } },
};

const COORD_RE = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

function normalise(query: string): string {
  return query
    .toLowerCase()
    .replace(/^(the|a)\s+/, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class GazetteerGeocoder implements Geocoder {
  async geocode(query: string): Promise<GeocodeResult | null> {
    const coords = COORD_RE.exec(query);
    if (coords) {
      const point = { latitude: Number(coords[1]), longitude: Number(coords[2]) };
      if (!isWithinServiceArea(point)) return null;
      return { query, label: query, point, source: 'COORDINATE', confidence: 1 };
    }

    const key = normalise(query);
    const exact = LANDMARK_GAZETTEER[key];
    if (exact) {
      return { query, label: exact.label, point: exact.point, source: 'GAZETTEER', confidence: 0.95 };
    }

    // Substring match, longest key first so "central park" does not shadow
    // "central park zoo"-style longer entries.
    const keys = Object.keys(LANDMARK_GAZETTEER).sort((a, b) => b.length - a.length);
    for (const candidate of keys) {
      if (key.includes(candidate) || candidate.includes(key)) {
        const hit = LANDMARK_GAZETTEER[candidate]!;
        return { query, label: hit.label, point: hit.point, source: 'GAZETTEER', confidence: 0.7 };
      }
    }
    return null;
  }
}

/** Tries each geocoder in turn and takes the first hit. */
export class ChainGeocoder implements Geocoder {
  constructor(private readonly chain: Geocoder[]) {}

  async geocode(query: string): Promise<GeocodeResult | null> {
    for (const g of this.chain) {
      const hit = await g.geocode(query);
      if (hit) return hit;
    }
    return null;
  }
}
