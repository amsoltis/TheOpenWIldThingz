import type { LineID } from '@streetlevel/shared';
import { isLineID } from '@streetlevel/shared';

import { rankStations, type StationCandidate } from './recover.js';

/**
 * Turning a photograph of a station sign into a station.
 *
 * This is the offline half of the camera recovery flow. Both mobile platforms
 * ship an on-device text recogniser, so the photo never has to leave the phone —
 * which is the whole point, because the traveller using this feature is by
 * definition somewhere their signal is bad and their nerve is worse.
 *
 * What arrives here is not a sentence. It is a bag of text fragments in
 * whatever order the recogniser found them, typically shouty, frequently
 * partial, and containing the line bullets as isolated glyphs:
 *
 *   ["EASTERN PKWY", "BROOKLYN MUSEUM", "2", "3", "4", "Downtown & Brooklyn"]
 *
 * The job is to get that to the existing ranker in a shape it can use, and to
 * be honest when it cannot.
 */

/** One line of text as returned by a device text recogniser. */
export interface RecognisedLine {
  text: string;
  /** 0..1 where the platform supplies it. Absent is treated as "unknown", not "bad". */
  confidence?: number;
}

/**
 * Below this we do not trust a fragment enough to let it influence the match.
 * Deliberately generous: a low-confidence fragment that happens to be right is
 * more useful than a missing one, and the ranker's own margin test is the real
 * guard against a bad identification.
 */
export const MIN_FRAGMENT_CONFIDENCE = 0.3;

/**
 * Glyph pairs a recogniser confuses when it has no word context to lean on.
 *
 * Station names are full of bare numbers ("23 St", "125 St") set in a face where
 * these pairs are genuinely close, and the recogniser has no dictionary to catch
 * itself with. Rather than guess which reading is right, we score both and keep
 * whichever matches better — an ambiguity resolved by the station list instead
 * of by a rule.
 */
const LETTER_TO_DIGIT: Record<string, string> = {
  O: '0', o: '0',
  I: '1', l: '1', i: '1',
  S: '5', s: '5',
  B: '8',
  Z: '2', z: '2',
  G: '6',
};

/** A sign's bullets are isolated glyphs. These are the ones that are also lines. */
function bulletFrom(fragment: string): LineID | null {
  const cleaned = fragment.trim().replace(/[^0-9A-Za-z]/g, '');
  if (cleaned.length !== 1) return null;
  const upper = cleaned.toUpperCase();
  return isLineID(upper) ? (upper as LineID) : null;
}

export interface SignReading {
  /** Everything worth matching on, joined into one query. */
  query: string;
  /** The same query with letter/digit confusions resolved toward digits. */
  digitVariant: string;
  /** Line bullets read off the sign. */
  bullets: LineID[];
  /** Fragments dropped for low confidence, kept for diagnostics. */
  discarded: string[];
}

export function readSign(lines: readonly RecognisedLine[]): SignReading {
  const kept: string[] = [];
  const discarded: string[] = [];
  const bullets: LineID[] = [];

  for (const line of lines) {
    const text = line.text?.trim();
    if (!text) continue;
    if (line.confidence !== undefined && line.confidence < MIN_FRAGMENT_CONFIDENCE) {
      discarded.push(text);
      continue;
    }
    const bullet = bulletFrom(text);
    if (bullet) {
      bullets.push(bullet);
      continue;
    }
    kept.push(text);
  }

  const query = kept.join(' ');
  const digitVariant = query.replace(/[A-Za-z]/g, (ch) => LETTER_TO_DIGIT[ch] ?? ch);

  return { query, digitVariant, bullets: [...new Set(bullets)], discarded };
}

export interface SignMatch {
  candidates: StationCandidate[];
  reading: SignReading;
  /** Which reading of the text won — useful when explaining a surprising match. */
  usedVariant: 'AS_READ' | 'DIGITS_RESOLVED';
}

/**
 * Ranks stations against a photographed sign.
 *
 * Runs the ranker twice — once on the text as recognised, once with the
 * letter/digit confusions pushed toward digits — and keeps the better result.
 * Trying both is cheap and it is the difference between "Z3 St" matching
 * nothing and matching 23 St.
 */
export function matchSign(lines: readonly RecognisedLine[], limit = 8): SignMatch {
  const reading = readSign(lines);

  const asRead = rankStations(reading.query, limit, reading.bullets);
  if (reading.digitVariant === reading.query) {
    return { candidates: asRead, reading, usedVariant: 'AS_READ' };
  }

  const resolved = rankStations(reading.digitVariant, limit, reading.bullets);
  const bestAsRead = asRead[0]?.score ?? 0;
  const bestResolved = resolved[0]?.score ?? 0;

  // Ties go to the text as the recogniser actually read it. Substituting glyphs
  // is a guess, and a guess should never beat the evidence on equal scores.
  return bestResolved > bestAsRead
    ? { candidates: resolved, reading, usedVariant: 'DIGITS_RESOLVED' }
    : { candidates: asRead, reading, usedVariant: 'AS_READ' };
}

/**
 * What to say when a photograph did not settle it.
 *
 * Distinct from the typed flow's questions on purpose: someone holding a camera
 * can be asked to point it somewhere else, which is a far easier instruction to
 * follow than "describe your surroundings" when you are already rattled.
 */
export function cameraClarifications(match: SignMatch): string[] {
  if (match.reading.query.trim().length === 0 && match.reading.bullets.length === 0) {
    return [
      'I could not read any text in that photo.',
      'Try the big name sign on the wall behind the tracks, or the sign hanging from the ceiling.',
      'Hold still for a moment — motion blur is the usual culprit down here.',
    ];
  }

  const names = match.candidates.slice(0, 3).map((c) => c.name);
  const questions = [
    names.length > 1
      ? `That could be ${names.join(', ')}. Photograph the coloured circles on the sign — the letters and numbers narrow it down fast.`
      : 'Photograph the coloured circles on the sign as well, so I can be sure which platform you are on.',
  ];
  if (match.reading.bullets.length === 0) {
    questions.push('A sign showing the line bullets would settle this.');
  }
  return questions;
}
