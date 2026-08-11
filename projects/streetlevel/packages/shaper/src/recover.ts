import type { LineID, RecoveryRequest, RecoveryResponse, StationID } from '@streetlevel/shared';
import { RECOVERY_CONFIDENCE_FLOOR, isLineID } from '@streetlevel/shared';
import { getIndex, type Geocoder } from '@streetlevel/data';
import { NoRouteFoundError, planTripFromStation } from '@streetlevel/router';

import { compileJourneyLeg } from './compile.js';
import type { NimClient } from './nim.js';

export interface StationCandidate {
  id: StationID;
  name: string;
  lines: LineID[];
  score: number;
}

/**
 * Pulls the usable signal out of a frightened person's description.
 *
 * People do not describe stations the way a database does. They type what is
 * physically in front of them — a number on a wall, a letter in a circle, a
 * word on a sign. Numbers are the strongest signal by far, because almost every
 * Manhattan station is named after the street it sits under.
 */
export function extractClues(description: string): {
  numbers: string[];
  lines: LineID[];
  words: string[];
} {
  const text = description.toLowerCase();

  // "23rd", "23 st", "125th street", "42nd" → the bare number.
  const numbers = [...text.matchAll(/\b(\d{1,3})\s*(?:st|nd|rd|th)?\b/g)]
    .map((m) => m[1]!)
    .filter((n) => Number(n) > 0);

  // A line is only claimed when the description frames it as one — "the 6
  // train", "an A", "L line". A bare "6" is far more likely to be 6th Avenue.
  const lines: LineID[] = [];
  const linePattern = /\b(?:the\s+|an?\s+)?([1-7abcdefgjlmnqrswz])\s*(?:train|line)\b/gi;
  for (const match of text.matchAll(linePattern)) {
    const token = match[1]!.toUpperCase();
    if (isLineID(token)) lines.push(token as LineID);
  }

  const words = text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);

  return { numbers, lines: [...new Set(lines)], words };
}

const STOP_WORDS = new Set([
  'station', 'train', 'platform', 'signs', 'sign', 'tiles', 'tile', 'wall', 'walls',
  'pillar', 'pillars', 'says', 'said', 'only', 'need', 'want', 'going', 'from',
  'this', 'that', 'there', 'here', 'with', 'have', 'about', 'street', 'stairs',
]);

function normaliseText(value: string): string {
  return value
    .toLowerCase()
    // People type "23rd"; the signage and the feed both read "23 St". The
    // suffix must be attached to the digits to count, so the "St" in "23 St"
    // is left alone.
    .replace(/(\d+)(?:st|nd|rd|th)\b/g, '$1')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(name: string): string[] {
  return normaliseText(name).split(' ').filter((t) => t.length > 0);
}

/**
 * Inverse document frequency over station names.
 *
 * Not every matched word is worth the same. "St" appears in most of the system
 * and tells us nothing; "Bedford" appears in three names and very nearly
 * identifies the station on its own. Weighting by rarity is what separates a
 * real identification from a coincidence, and it is computed from the station
 * list itself so it stays correct as the network changes.
 */
let idfCache: Map<string, number> | null = null;

function tokenIdf(): Map<string, number> {
  if (idfCache) return idfCache;
  const index = getIndex();
  const stations = Object.values(index.stations);
  const documentFrequency = new Map<string, number>();

  for (const station of stations) {
    for (const token of new Set(nameTokens(station.name))) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [token, df] of documentFrequency) {
    idf.set(token, Math.log(stations.length / df));
  }
  idfCache = idf;
  return idf;
}

/** Score at which a match is considered as good as it needs to get. */
const SCORE_SATURATION = 8;
/** A whole station name appearing verbatim is the clearest signal available. */
const FULL_NAME_BONUS = 8;
/** Naming the line narrows a shared station name to one platform. */
const LINE_BONUS = 4;

/**
 * Ranks stations against a description.
 *
 * Scores are deliberately interpretable rather than learned: when this is wrong
 * it needs to be wrong in a way an engineer can read off the inputs, because
 * the cost of a confident mistake here is a person following instructions from
 * the wrong platform.
 */
export function rankStations(
  description: string,
  limit = 8,
  /**
   * Lines known from something other than the prose — the bullets read off a
   * photographed sign, say. Typed descriptions have to earn a line claim
   * ("the 6 train"), because a bare "6" is far more likely to be 6th Avenue.
   * A sign has no such ambiguity: an isolated glyph in a circle *is* a bullet.
   */
  knownLines: readonly LineID[] = [],
): StationCandidate[] {
  const { lines: spokenLines } = extractClues(description);
  const lines = [...new Set([...spokenLines, ...knownLines])];
  const index = getIndex();
  const idf = tokenIdf();
  const normalisedDescription = normaliseText(description);
  const describedTokens = new Set(normalisedDescription.split(' '));
  const scored: StationCandidate[] = [];

  for (const station of Object.values(index.stations)) {
    const normalisedName = normaliseText(station.name);
    let score = 0;

    for (const token of new Set(nameTokens(station.name))) {
      if (STOP_WORDS.has(token)) continue;
      if (describedTokens.has(token)) score += idf.get(token) ?? 0;
    }

    if (normalisedName.length > 3 && normalisedDescription.includes(normalisedName)) {
      score += FULL_NAME_BONUS;
    }
    for (const line of lines) {
      if (station.lines.includes(line)) score += LINE_BONUS;
    }

    if (score > 0) scored.push({ id: station.id, name: station.name, lines: station.lines, score });
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}

/**
 * Confidence from the shape of the ranking, not from the top score alone.
 *
 * A high score that four stations share is not knowledge — "23 St" names four
 * different stations on four different lines, and picking one at random would
 * be the worst thing this system could do. Confidence therefore comes from the
 * margin between the best candidate and the runner-up.
 */
export function confidenceFromRanking(candidates: StationCandidate[]): number {
  if (candidates.length === 0) return 0;
  const best = candidates[0]!.score;
  if (best === 0) return 0;
  const runnerUp = candidates[1]?.score ?? 0;

  /**
   * A tie at the top is ignorance, however strong the match.
   *
   * Four stations are called "23 St". Reading that name off a wall scores all
   * four identically and perfectly — a maximal score with a zero margin — and
   * an earlier version of this formula landed that case on exactly
   * RECOVERY_CONFIDENCE_FLOOR. The floor is tested with `<`, so the tie passed
   * and the resolver would have routed somebody from whichever of the four
   * sorted first. Capped explicitly rather than left to the arithmetic, because
   * the arithmetic happening to clear the bar was the bug.
   */
  if (runnerUp === best) return TIED_CONFIDENCE;

  const margin = (best - runnerUp) / best;
  const strength = Math.min(1, best / SCORE_SATURATION);
  // Both terms scale with strength: a wide margin between two weak matches is
  // still two weak matches, and should not read as certainty.
  return Math.min(0.95, strength * (0.35 + 0.65 * margin));
}

/**
 * What a perfect tie is worth. Non-zero because knowing it is one of four named
 * stations is real information — it drives the clarifying question — but
 * comfortably under the floor, because it is not enough to route on.
 */
const TIED_CONFIDENCE = 0.2;

function clarifyingQuestionsFor(candidates: StationCandidate[]): string[] {
  const questions = [
    'What is written on the nearest sign hanging from the ceiling? Copy it exactly.',
    'Which letters or numbers are in the coloured circles on that sign?',
  ];
  const names = candidates.slice(0, 3).map((c) => c.name);
  if (names.length > 1) {
    questions.push(`Does the name on the wall look like any of these: ${names.join(', ')}?`);
  }
  return questions;
}

export interface ResolveOptions {
  geocoder: Geocoder;
  nim?: NimClient;
  at?: Date;
}

/**
 * The "Ask a New Yorker" resolver.
 *
 * Order matters: the deterministic ranker runs first and produces the shortlist,
 * and the language model may only choose from that shortlist. That inversion is
 * the whole safety property — the model refines a decision between real
 * stations instead of naming one.
 */
export async function resolveAndRecover(
  request: RecoveryRequest,
  options: ResolveOptions,
): Promise<RecoveryResponse> {
  const candidates = rankStations(request.surroundingsDescription);

  if (candidates.length === 0) {
    return {
      resolvedStationId: '',
      resolvedStationName: '',
      confidence: 0,
      reasoningPlainText:
        'Nothing in that description matched a station name. Read me something printed on a sign or a wall.',
      recoveryCards: [],
      clarifyingQuestions: [
        'What station name is printed on the wall tiles or the platform sign?',
        'Which letters or numbers are in the coloured circles on the signs above you?',
        'Is there a shop, a staircase, or a booth nearby with a name on it?',
      ],
    };
  }

  let chosen = candidates[0]!;
  let confidence = confidenceFromRanking(candidates);
  let reasoning = `The name "${chosen.name}" matches what you described.`;

  const verdict = await options.nim?.resolveStation(request.surroundingsDescription, candidates);
  if (verdict?.stationId) {
    const match = candidates.find((c) => c.id === verdict.stationId);
    if (match) {
      chosen = match;
      // Take the model's read only when it is more cautious, or when it agrees
      // with the ranker. A model talking itself into certainty about somebody
      // else's location is precisely what must not happen here.
      confidence = match.id === candidates[0]!.id ? Math.max(confidence, verdict.confidence) : Math.min(confidence, verdict.confidence);
      if (verdict.reasoningPlainText) reasoning = verdict.reasoningPlainText;
    }
  } else if (verdict && verdict.stationId === null) {
    confidence = Math.min(confidence, verdict.confidence);
    if (verdict.reasoningPlainText) reasoning = verdict.reasoningPlainText;
  }

  if (confidence < RECOVERY_CONFIDENCE_FLOOR) {
    return {
      resolvedStationId: chosen.id,
      resolvedStationName: chosen.name,
      confidence,
      reasoningPlainText:
        `That could be ${candidates.slice(0, 3).map((c) => c.name).join(', ')}. ` +
        'I need one more detail before I send you anywhere.',
      recoveryCards: [],
      clarifyingQuestions: verdict?.clarifyingQuestions?.length
        ? verdict.clarifyingQuestions
        : clarifyingQuestionsFor(candidates),
    };
  }

  if (!request.intendedDestinationAddress) {
    return {
      resolvedStationId: chosen.id,
      resolvedStationName: chosen.name,
      confidence,
      reasoningPlainText: reasoning,
      recoveryCards: [],
      clarifyingQuestions: ['Where were you trying to get to?'],
    };
  }

  try {
    const trip = await planTripFromStation(chosen.id, request.intendedDestinationAddress, {
      at: options.at ?? new Date(),
      geocoder: options.geocoder,
    });
    const leg = compileJourneyLeg(trip, {
      plannedDepartureWindow: 'Right now',
      idPrefix: `rec-${chosen.id}`,
      startsUnderground: true,
    });
    return {
      resolvedStationId: chosen.id,
      resolvedStationName: chosen.name,
      confidence,
      reasoningPlainText: reasoning,
      recoveryCards: leg.navigationCards,
    };
  } catch (err) {
    const message =
      err instanceof NoRouteFoundError
        ? err.message
        : 'I could not build a route from there right now.';
    return {
      resolvedStationId: chosen.id,
      resolvedStationName: chosen.name,
      confidence,
      reasoningPlainText: `${reasoning} ${message}`,
      recoveryCards: [],
      clarifyingQuestions: ['Where were you trying to get to?'],
    };
  }
}
