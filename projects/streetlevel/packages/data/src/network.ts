import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { LineID, StationID } from '@streetlevel/shared';

import { haversineMeters, type LatLon } from './geo.js';
import type { StationNode, SubwayNetwork, TrackEdge } from './types.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * `generated/network.json` is a build artefact, not source. It is read at
 * runtime rather than imported so that a rebuilt dataset takes effect without
 * recompiling every dependent package.
 */
function resolveNetworkPath(): string {
  // dist/ and src/ sit at the same depth, so one relative path serves both the
  // compiled and the tsx-executed case.
  return path.resolve(here, '../generated/network.json');
}

let cached: SubwayNetwork | null = null;

export function loadNetwork(): SubwayNetwork {
  if (cached) return cached;
  const file = resolveNetworkPath();
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new Error(
      `Station graph missing at ${file}.\n` +
        'Build it with:\n' +
        '  npm run fetch:gtfs   --workspace=@streetlevel/data\n' +
        '  npm run build:dataset --workspace=@streetlevel/data',
    );
  }
  cached = JSON.parse(raw) as SubwayNetwork;
  return cached;
}

/** Test seam: swap in a small hand-built graph. */
export function __setNetworkForTesting(network: SubwayNetwork | null): void {
  cached = network;
}

/* ------------------------------------------------------------------ *
 * Indexed views
 * ------------------------------------------------------------------ */

export interface NetworkIndex {
  network: SubwayNetwork;
  stations: Record<StationID, StationNode>;
  /** Outbound track edges keyed by origin station. */
  edgesFrom: Map<StationID, TrackEdge[]>;
  /** Walking connections keyed by origin station, both directions present. */
  transfersFrom: Map<StationID, { to: StationID; seconds: number; inPlace: boolean }[]>;
  /** Every station sharing an in-system passageway, keyed by complex id. */
  complexMembers: Map<string, StationID[]>;
}

let cachedIndex: NetworkIndex | null = null;

export function getIndex(): NetworkIndex {
  const network = loadNetwork();
  if (cachedIndex && cachedIndex.network === network) return cachedIndex;

  const edgesFrom = new Map<StationID, TrackEdge[]>();
  for (const edge of network.edges) {
    const list = edgesFrom.get(edge.from);
    if (list) list.push(edge);
    else edgesFrom.set(edge.from, [edge]);
  }

  const transfersFrom = new Map<StationID, { to: StationID; seconds: number; inPlace: boolean }[]>();
  const addTransfer = (from: StationID, to: StationID, seconds: number, inPlace: boolean) => {
    const list = transfersFrom.get(from);
    const entry = { to, seconds, inPlace };
    if (list) {
      if (!list.some((t) => t.to === to)) list.push(entry);
    } else {
      transfersFrom.set(from, [entry]);
    }
  };
  for (const t of network.transfers) {
    if (t.from === t.to) continue; // an in-place transfer is not a graph move
    addTransfer(t.from, t.to, t.seconds, t.inPlace);
    addTransfer(t.to, t.from, t.seconds, t.inPlace);
  }

  const complexMembers = new Map<string, StationID[]>();
  for (const station of Object.values(network.stations)) {
    const list = complexMembers.get(station.complexId);
    if (list) list.push(station.id);
    else complexMembers.set(station.complexId, [station.id]);
  }

  cachedIndex = { network, stations: network.stations, edgesFrom, transfersFrom, complexMembers };
  return cachedIndex;
}

export function getStation(id: StationID): StationNode | undefined {
  return getIndex().stations[id];
}

export function stationName(id: StationID): string {
  return getIndex().stations[id]?.name ?? id;
}

/** All stations you can reach on foot without leaving the fare-paid area. */
export function complexSiblings(id: StationID): StationID[] {
  const index = getIndex();
  const station = index.stations[id];
  if (!station) return [];
  return (index.complexMembers.get(station.complexId) ?? []).filter((s) => s !== id);
}

/**
 * Every line that physically serves the same platform level as `line` at this
 * station — what the traveller will actually watch pull in. Feeds
 * `coLocatedLinesToDim`.
 */
export function coLocatedLines(stationId: StationID, line: LineID): LineID[] {
  const station = getStation(stationId);
  if (!station) return [];
  return station.lines.filter((l) => l !== line);
}

/* ------------------------------------------------------------------ *
 * Nearest-station search
 * ------------------------------------------------------------------ */

export interface NearbyStation {
  station: StationNode;
  meters: number;
}

export function nearestStations(point: LatLon, limit = 5): NearbyStation[] {
  const index = getIndex();
  const scored: NearbyStation[] = [];
  for (const station of Object.values(index.stations)) {
    scored.push({ station, meters: haversineMeters(point, station) });
  }
  scored.sort((a, b) => a.meters - b.meters);
  return scored.slice(0, limit);
}

/**
 * Candidate origin stations, deduplicated by complex.
 *
 * Two platforms of the same complex are one decision to a traveller, so
 * offering both as separate options is noise — and would let the router pick a
 * technically-faster platform that is a five-minute underground walk from the
 * entrance we told them to use.
 */
export function nearestStationComplexes(point: LatLon, limit = 4): NearbyStation[] {
  const seen = new Set<string>();
  const out: NearbyStation[] = [];
  for (const candidate of nearestStations(point, 40)) {
    if (seen.has(candidate.station.complexId)) continue;
    seen.add(candidate.station.complexId);
    out.push(candidate);
    if (out.length >= limit) break;
  }
  return out;
}

export function findStationsByName(query: string): StationNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return Object.values(getIndex().stations).filter((s) => s.name.toLowerCase().includes(needle));
}
