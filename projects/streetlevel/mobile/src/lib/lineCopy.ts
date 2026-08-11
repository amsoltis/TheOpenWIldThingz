import type { LineID } from '@streetlevel/shared';
import { LINE_COLOR_NAMES } from '@streetlevel/shared';

/**
 * Copy for Contextual Peripheral Dimming.
 *
 * The rule behind every string here: never hide a train the traveller can
 * physically see. A platform where four services share the track will send
 * three trains the user must ignore, and an interface that pretends those
 * trains do not exist reads as broken at exactly the moment trust matters. So
 * we name them, in the colour word printed on the bullet above their head, and
 * tell them explicitly that letting one go is the correct action.
 */

export function colourWordsFor(lines: readonly LineID[]): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const line of lines) {
    const word = LINE_COLOR_NAMES[line];
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words;
}

export function joinWithAnd(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  const head = items.slice(0, -1).join(', ');
  return `${head} and ${items[items.length - 1] ?? ''}`;
}

/**
 * True when a train the traveller must ignore wears the same colour as theirs.
 *
 * The 1, 2 and 3 are all red; the N, Q, R and W are all yellow. On those
 * platforms colour is not a disambiguator, it is a trap — "wait for the red
 * train" is exactly wrong advice at Times Square. Where colour cannot separate
 * them, the copy has to fall back on the number, which is the only thing that
 * actually differs on the front of the train.
 */
export function colourIsAmbiguous(activeLine: LineID, dimmedLines: readonly LineID[]): boolean {
  const mine = LINE_COLOR_NAMES[activeLine];
  return dimmedLines.some((line) => LINE_COLOR_NAMES[line] === mine);
}

export function peripheralReassuranceText(
  dimmedLines: readonly LineID[],
  activeLine?: LineID,
): string {
  if (dimmedLines.length === 0) return '';

  if (activeLine && colourIsAmbiguous(activeLine, dimmedLines)) {
    const sameColour = dimmedLines.filter((l) => LINE_COLOR_NAMES[l] === LINE_COLOR_NAMES[activeLine]);
    return (
      `The ${joinWithAnd(sameColour.map(String))} stop here too and are the same colour as yours. ` +
      `Do not go by colour here — read the number on the front of the train.`
    );
  }

  const colours = colourWordsFor(dimmedLines);
  const subject = colours.length === 1 ? `${colours[0]} trains` : `${joinWithAnd(colours)} trains`;
  return `You will see ${subject} pulling in here. They are dimmed because they are irrelevant to you. Let them pass.`;
}

export function targetLineReassuranceText(
  activeLine: LineID,
  dimmedLines: readonly LineID[] = [],
): string {
  if (colourIsAmbiguous(activeLine, dimmedLines)) {
    return `Your train is the ${activeLine}. Check the number, not the colour — the others here are the same colour.`;
  }
  return `Your train is the ${LINE_COLOR_NAMES[activeLine]} ${activeLine}. Board only that one.`;
}

export function lineAccessibilityLabel(line: LineID, dimmed: boolean): string {
  const base = `${LINE_COLOR_NAMES[line]} ${line} train`;
  return dimmed ? `${base}, not your train` : `${base}, your train`;
}
