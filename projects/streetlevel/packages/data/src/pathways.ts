import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { parseCsv } from './csv.js';

/**
 * GTFS-Pathways: indoor navigation, as a standard rather than as a survey.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * The micro-navigation layer started as a hand-rolled schema in `micronav.ts`
 * on the assumption that "which staircase" is knowledge only a person standing
 * in the station can write down. That is half true. The *car-to-exit alignment*
 * genuinely is survey knowledge and no transit authority publishes it. But
 * everything else — entrances with coordinates, stairs, escalators, elevators,
 * fare gates, how long a passage takes to walk, and critically the text
 * printed on the sign above it — is a solved, standardised problem:
 * GTFS-Pathways, the same specification the schedule feed already uses.
 *
 * So this models the standard rather than inventing a private one. Two things
 * follow. Data an agency publishes drops straight in with no translation. And
 * anything surveyed by hand is authored in the same shape, so there is one
 * internal representation of "how do I physically get from here to there"
 * rather than two that drift.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THE MTA ACTUALLY PUBLISHES, AS OF THIS FEED
 *
 * Not this. `gtfs_subway.zip` and `gtfs_supplemented.zip` carry only
 * `location_type` 1 (stations) and blank (platforms) — no entrance nodes, no
 * `pathways.txt`, no `levels.txt`. The agency does publish entrance and
 * elevator/escalator inventories, but on open-data hosts unreachable from this
 * build environment, and in their own shapes rather than as GTFS-Pathways.
 *
 * The importer below is therefore written against the specification and tested
 * against fixtures, not against a live agency feed. When a feed with pathways
 * appears in the GTFS directory it is picked up automatically. That is the
 * honest status: ready and unexercised on real agency data.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** `pathway_mode` values, per the GTFS-Pathways specification. */
export const PATHWAY_MODE = {
  WALKWAY: 1,
  STAIRS: 2,
  MOVING_SIDEWALK: 3,
  ESCALATOR: 4,
  ELEVATOR: 5,
  FARE_GATE: 6,
  EXIT_GATE: 7,
} as const;

export type PathwayMode = (typeof PATHWAY_MODE)[keyof typeof PATHWAY_MODE];

export interface Pathway {
  pathwayId: string;
  fromStopId: string;
  toStopId: string;
  mode: PathwayMode;
  isBidirectional: boolean;
  /** Metres. */
  length?: number;
  /** Seconds to traverse. */
  traversalTime?: number;
  /** Positive going up, negative going down. */
  stairCount?: number;
  maxSlope?: number;
  minWidth?: number;
  /**
   * The text printed on the sign over this passage.
   *
   * The single most valuable field in the specification for this product. Every
   * instruction the app gives is trying to name something the traveller can
   * physically read, and this is that text, from the agency, verbatim.
   */
  signpostedAs?: string;
  /** The sign text when travelling the other way down a bidirectional pathway. */
  reversedSignpostedAs?: string;
}

export interface StationLevel {
  levelId: string;
  /** 0 is the ground level; negative is below it. */
  levelIndex: number;
  levelName?: string;
}

/** `location_type = 2`: a street-level way in or out. */
export interface EntranceNode {
  stopId: string;
  name: string;
  parentStationId: string;
  latitude: number;
  longitude: number;
  /**
   * From `wheelchair_boarding`: 1 = accessible entrance, 2 = not accessible.
   * Undefined means the feed did not say, which is not the same as "no".
   */
  wheelchairBoarding?: 1 | 2;
}

export interface PathwayDataset {
  pathways: Pathway[];
  levels: StationLevel[];
  entrances: EntranceNode[];
}

export const EMPTY_PATHWAY_DATASET: PathwayDataset = { pathways: [], levels: [], entrances: [] };

function numberOrUndefined(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function isPathwayMode(value: number | undefined): value is PathwayMode {
  return value !== undefined && value >= 1 && value <= 7;
}

export function parsePathways(text: string): Pathway[] {
  const out: Pathway[] = [];
  for (const row of parseCsv(text)) {
    const pathwayId = row['pathway_id'];
    const fromStopId = row['from_stop_id'];
    const toStopId = row['to_stop_id'];
    const mode = numberOrUndefined(row['pathway_mode']);
    if (!pathwayId || !fromStopId || !toStopId || !isPathwayMode(mode)) continue;

    const pathway: Pathway = {
      pathwayId,
      fromStopId,
      toStopId,
      mode,
      isBidirectional: row['is_bidirectional'] === '1',
    };
    const length = numberOrUndefined(row['length']);
    const traversalTime = numberOrUndefined(row['traversal_time']);
    const stairCount = numberOrUndefined(row['stair_count']);
    const maxSlope = numberOrUndefined(row['max_slope']);
    const minWidth = numberOrUndefined(row['min_width']);
    if (length !== undefined) pathway.length = length;
    if (traversalTime !== undefined) pathway.traversalTime = traversalTime;
    if (stairCount !== undefined) pathway.stairCount = stairCount;
    if (maxSlope !== undefined) pathway.maxSlope = maxSlope;
    if (minWidth !== undefined) pathway.minWidth = minWidth;
    if (row['signposted_as']?.trim()) pathway.signpostedAs = row['signposted_as'].trim();
    if (row['reversed_signposted_as']?.trim()) {
      pathway.reversedSignpostedAs = row['reversed_signposted_as'].trim();
    }
    out.push(pathway);
  }
  return out;
}

export function parseLevels(text: string): StationLevel[] {
  const out: StationLevel[] = [];
  for (const row of parseCsv(text)) {
    const levelId = row['level_id'];
    const levelIndex = numberOrUndefined(row['level_index']);
    if (!levelId || levelIndex === undefined) continue;
    const level: StationLevel = { levelId, levelIndex };
    if (row['level_name']?.trim()) level.levelName = row['level_name'].trim();
    out.push(level);
  }
  return out;
}

/** Pulls `location_type = 2` rows out of a stops table. */
export function parseEntrances(text: string): EntranceNode[] {
  const out: EntranceNode[] = [];
  for (const row of parseCsv(text)) {
    if (row['location_type'] !== '2') continue;
    const stopId = row['stop_id'];
    const parentStationId = row['parent_station'];
    const latitude = numberOrUndefined(row['stop_lat']);
    const longitude = numberOrUndefined(row['stop_lon']);
    if (!stopId || !parentStationId || latitude === undefined || longitude === undefined) continue;

    const entrance: EntranceNode = {
      stopId,
      name: row['stop_name'] ?? stopId,
      parentStationId,
      latitude,
      longitude,
    };
    const wheelchair = numberOrUndefined(row['wheelchair_boarding']);
    if (wheelchair === 1 || wheelchair === 2) entrance.wheelchairBoarding = wheelchair;
    out.push(entrance);
  }
  return out;
}

/**
 * Reads the optional indoor-navigation tables from a GTFS directory.
 *
 * Absence is the normal case today and is not an error: the schedule feed is
 * complete without them, and the product degrades to station-level guidance.
 */
export async function loadPathwayDataset(gtfsDir: string): Promise<PathwayDataset> {
  const read = async (file: string): Promise<string | null> => {
    const target = path.join(gtfsDir, file);
    return existsSync(target) ? readFile(target, 'utf8') : null;
  };

  const [pathwaysText, levelsText, stopsText] = await Promise.all([
    read('pathways.txt'),
    read('levels.txt'),
    read('stops.txt'),
  ]);

  return {
    pathways: pathwaysText ? parsePathways(pathwaysText) : [],
    levels: levelsText ? parseLevels(levelsText) : [],
    entrances: stopsText ? parseEntrances(stopsText) : [],
  };
}

/* ------------------------------------------------------------------ *
 * Turning a pathway into something a traveller can act on
 * ------------------------------------------------------------------ */

export interface PathwayDescription {
  /** The imperative: "Take the escalator down". */
  instruction: string;
  /** What to look for, in the order it becomes useful. */
  anchors: string[];
  /** Set when going the wrong way through this is expensive to undo. */
  warning?: string;
}

const LEVEL_BY_ID = (levels: StationLevel[]): Map<string, StationLevel> =>
  new Map(levels.map((l) => [l.levelId, l]));

/**
 * Plain English for one pathway.
 *
 * The sign text leads whenever the agency supplied it, because "follow the sign
 * that says Downtown & Brooklyn" is checkable against the ceiling and "walk 40
 * metres bearing left" is not.
 */
export function describePathway(
  pathway: Pathway,
  options: { reversed?: boolean; levels?: StationLevel[] } = {},
): PathwayDescription {
  const sign = options.reversed
    ? (pathway.reversedSignpostedAs ?? pathway.signpostedAs)
    : pathway.signpostedAs;
  const anchors: string[] = [];

  // stair_count is signed: positive climbs, negative descends. Reversing the
  // direction of travel flips that, which is exactly the sort of detail that
  // sends someone up when they should be going down.
  const rawStairs = pathway.stairCount;
  const stairs =
    rawStairs === undefined ? undefined : options.reversed ? -rawStairs : rawStairs;
  const goingDown = stairs !== undefined && stairs < 0;
  const direction = stairs === undefined ? '' : goingDown ? ' down' : ' up';

  let instruction: string;
  let warning: string | undefined;

  switch (pathway.mode) {
    case PATHWAY_MODE.STAIRS:
      instruction = `Take the stairs${direction}.`;
      if (stairs !== undefined) anchors.push(`${Math.abs(stairs)} steps.`);
      break;
    case PATHWAY_MODE.ESCALATOR:
      instruction = `Take the escalator${direction}.`;
      break;
    case PATHWAY_MODE.ELEVATOR:
      instruction = 'Take the elevator.';
      break;
    case PATHWAY_MODE.MOVING_SIDEWALK:
      instruction = 'Take the moving walkway.';
      break;
    case PATHWAY_MODE.FARE_GATE:
      instruction = 'Tap in at the turnstile.';
      break;
    case PATHWAY_MODE.EXIT_GATE:
      instruction = 'Go through the exit gate.';
      // A classic and expensive tourist mistake: exit-only gates do not let you
      // back in, and re-entering means paying a second fare.
      warning = 'This gate only goes one way. Once through it you cannot come back without paying again.';
      break;
    default:
      instruction = 'Follow the passage.';
      break;
  }

  if (sign) anchors.unshift(`Follow the sign that reads "${sign}".`);

  if (pathway.traversalTime !== undefined && pathway.traversalTime >= 60) {
    const minutes = Math.round(pathway.traversalTime / 60);
    anchors.push(`It takes about ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  const levels = options.levels ? LEVEL_BY_ID(options.levels) : null;
  if (levels && pathway.mode === PATHWAY_MODE.ELEVATOR) {
    const to = levels.get(pathway.toStopId);
    if (to?.levelName) anchors.push(`You want the level marked "${to.levelName}".`);
  }

  return warning ? { instruction, anchors, warning } : { instruction, anchors };
}

/** Pathways leaving a node, including bidirectional ones traversed backwards. */
export function pathwaysFrom(
  dataset: PathwayDataset,
  stopId: string,
): { pathway: Pathway; reversed: boolean }[] {
  const out: { pathway: Pathway; reversed: boolean }[] = [];
  for (const pathway of dataset.pathways) {
    if (pathway.fromStopId === stopId) out.push({ pathway, reversed: false });
    else if (pathway.isBidirectional && pathway.toStopId === stopId) {
      out.push({ pathway, reversed: true });
    }
  }
  return out;
}

/**
 * Whether a station can be entered and traversed step-free.
 *
 * Deliberately conservative: an unknown pathway counts against accessibility,
 * because telling a wheelchair user a station works when the data merely failed
 * to mention a staircase is the worst possible error here.
 */
export function isStepFree(dataset: PathwayDataset, stationId: string): boolean {
  const relevant = dataset.pathways.filter(
    (p) => p.fromStopId.startsWith(stationId) || p.toStopId.startsWith(stationId),
  );
  if (relevant.length === 0) return false;
  return relevant.every(
    (p) => p.mode !== PATHWAY_MODE.STAIRS && (p.stairCount === undefined || p.stairCount === 0),
  );
}
