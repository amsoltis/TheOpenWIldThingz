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

export function peripheralReassuranceText(dimmedLines: readonly LineID[]): string {
  const colours = colourWordsFor(dimmedLines);
  if (colours.length === 0) return '';
  const subject = colours.length === 1 ? `${colours[0]} trains` : `${joinWithAnd(colours)} trains`;
  return `You will see ${subject} pulling in here. They are dimmed because they are irrelevant to you. Let them pass.`;
}

export function targetLineReassuranceText(activeLine: LineID): string {
  return `Your train is the ${LINE_COLOR_NAMES[activeLine]} ${activeLine}. Board only that one.`;
}

export function lineAccessibilityLabel(line: LineID, dimmed: boolean): string {
  const base = `${LINE_COLOR_NAMES[line]} ${line} train`;
  return dimmed ? `${base}, not your train` : `${base}, your train`;
}
