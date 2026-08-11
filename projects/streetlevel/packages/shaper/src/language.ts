import type { LineID } from '@streetlevel/shared';
import { LINE_COLOR_NAMES } from '@streetlevel/shared';
import { BOROUGH_NAMES, type BoroughCode } from '@streetlevel/data';

/**
 * The plain-English rules, in one place.
 *
 * Rule one of the product: a tourist does not know what "uptown" means, does
 * not know which way is north while standing underground, and cannot use a
 * compass bearing to pick a staircase. Everything here converts spatial fact
 * into something they can physically verify — a word printed on a train, a
 * borough name, a colour they can see.
 */

/** Compass words, which must never reach a traveller-facing string. */
const COMPASS_WORDS =
  /\b(north|south|east|west|northbound|southbound|eastbound|westbound|northeast|northwest|southeast|southwest)\b/i;

/**
 * Guard used in tests and on any LLM-rewritten prose. "Uptown" and "downtown"
 * are allowed only when quoting what a physical sign says, which the caller
 * marks explicitly.
 */
export function containsCompassDirection(text: string): boolean {
  return COMPASS_WORDS.test(text);
}

export function pluralStops(count: number): string {
  return count === 1 ? '1 stop' : `${count} stops`;
}

export function minutesText(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return mins === 1 ? 'about a minute' : `about ${mins} minutes`;
}

/**
 * How to describe the train the traveller is about to board.
 *
 * The headsign is the single most reliable thing in the system: it is lit up on
 * the front of the train and repeated on the platform sign. Borough is added
 * only when the trip actually crosses into another borough, where it is a real
 * orientation cue rather than noise.
 */
export function directionPhrase(
  headsign: string,
  fromBorough: BoroughCode,
  toBorough: BoroughCode,
): string {
  const sign = headsign.trim();
  if (!sign) {
    return toBorough !== fromBorough ? `toward ${BOROUGH_NAMES[toBorough]}` : 'in your direction of travel';
  }
  if (toBorough !== fromBorough) {
    return `toward **${sign}** (heading into ${BOROUGH_NAMES[toBorough]})`;
  }
  return `toward **${sign}**`;
}

export function lineColourWord(line: LineID): string {
  return LINE_COLOR_NAMES[line];
}

/**
 * The peripheral-dimming sentence.
 *
 * Hiding the other trains would be worse than mentioning them: a traveller who
 * watches a train pull in that their app never mentioned assumes the app is
 * broken. Naming them and giving explicit permission to ignore them is the
 * whole trick.
 */
export function dimmedLinesSentence(target: LineID, dimmed: LineID[]): string | null {
  if (dimmed.length === 0) return null;
  const colours = [...new Set(dimmed.map((l) => LINE_COLOR_NAMES[l]))];
  const others = dimmed.join(', ');
  const colourPhrase =
    colours.length === 1 ? `${colours[0]} trains` : `${colours.slice(0, -1).join(', ')} and ${colours.at(-1)} trains`;
  return `You will also see ${colourPhrase} (${others}) stopping here. They are dimmed on your screen because they are not yours. Let them pass — you want the ${LINE_COLOR_NAMES[target]} ${target}.`;
}

/** Trains are 8–11 cars; the middle is the safest generic advice. */
export const DEFAULT_CAR_INDEX = 5;
export const ASSUMED_TRAIN_CARS = 10;

export function carPositionText(carIndex: number): string {
  if (carIndex <= 2) return 'Walk to the front of the platform before the train arrives.';
  if (carIndex >= ASSUMED_TRAIN_CARS - 1) return 'Walk to the far end of the platform before the train arrives.';
  return 'Stand around the middle of the platform.';
}

export function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
}
