/**
 * Reading structured facts back out of the compiler's prose.
 *
 * The contract carries the instruction as one markdown sentence, which is right
 * for a screen reader and right for the traveller, but a station-identity hero
 * or an MTA sign plate needs the *pieces*: which station, which lines, what the
 * ceiling sign says. Rather than widen the wire contract, these read the exact
 * sentences `@streetlevel/shaper` emits.
 *
 * Every function here fails to `null` or `[]` rather than guessing. A hero that
 * quietly does not render is a smaller product than intended; a hero showing an
 * invented station name is a traveller sent to the wrong building.
 */
import type { LineID } from '@streetlevel/shared';
import { isLineID } from '@streetlevel/shared';

import { parseInlineMarkdown } from './markdown';

/**
 * The emphasised phrases in an instruction. The shaper bolds exactly the words
 * that carry the decision — the line, the station to get off at — so this is a
 * far steadier source than pattern-matching the surrounding prose.
 */
export function boldPhrases(markdown: string): string[] {
  return parseInlineMarkdown(markdown)
    .filter((segment) => segment.bold)
    .map((segment) => segment.text.trim())
    .filter((text) => text.length > 0);
}

const LINES_SERVED = /will list the (.+?)\s+trains?\b/i;

/** Every line whose bullet is printed on the station sign, in the order the sign lists them. */
export function linesServedFrom(texts: readonly string[]): LineID[] {
  const found: LineID[] = [];
  for (const text of texts) {
    const match = LINES_SERVED.exec(text);
    if (!match?.[1]) continue;
    for (const token of match[1].split(/[,/&]| and /)) {
      const candidate = token.trim().toUpperCase();
      if (isLineID(candidate) && !found.includes(candidate)) found.push(candidate);
    }
  }
  return found;
}

const STATION_ON_SIGN = /station name on the sign reads "([^"]+)"/i;
const STATION_ON_STAIRCASE = /sign reading "([^"]+)"/i;

/**
 * The station name as it is physically printed, which is not always the name in
 * the instruction sentence: "Times Sq-42 St station in Manhattan" is prose, and
 * `Times Sq-42 St` is what is bolted to the wall.
 */
export function stationNameFrom(texts: readonly string[]): string | null {
  for (const pattern of [STATION_ON_SIGN, STATION_ON_STAIRCASE]) {
    for (const text of texts) {
      const match = pattern.exec(text);
      if (match?.[1]) return match[1];
    }
  }
  return null;
}

/** Strips the trailing word the shaper appends when it has no surveyed crossing to name. */
export function stripStationSuffix(text: string): string {
  return text.replace(/\s+station$/i, '');
}

const CEILING_MARKER = /^Overhead sign:\s*"(.+)"$/i;
const PLATFORM_HEADSIGN = /will name "([^"]+)"/i;

/**
 * What is actually painted on the plate hanging from the ceiling. Surveyed
 * connections give us the marker verbatim; everywhere else the best we honestly
 * have is the headsign the platform signs carry.
 */
export function overheadSignLegends(texts: readonly string[]): string[] {
  const legends: string[] = [];
  for (const text of texts) {
    const marker = CEILING_MARKER.exec(text.trim());
    if (marker?.[1]) {
      if (!legends.includes(marker[1])) legends.push(marker[1]);
      continue;
    }
    const headsign = PLATFORM_HEADSIGN.exec(text);
    if (headsign?.[1] && !legends.includes(headsign[1])) legends.push(headsign[1]);
  }
  return legends;
}

/** An anchor whose whole content is already printed on the drawn sign plate. */
export function isSignAnchor(text: string): boolean {
  return CEILING_MARKER.test(text.trim()) || PLATFORM_HEADSIGN.test(text);
}

/**
 * The dimming sentence the shaper writes into the anchors.
 *
 * The platform card already prints this reassurance in full, next to the actual
 * bullets, under a heading that says NOT YOURS. Leaving the anchor in the
 * confirm-before-you-board list as well makes the traveller read the same
 * warning twice in two slightly different wordings, which is worse than reading
 * it once — a stranger cannot tell whether the second one is a new instruction.
 * So the drawn version wins and the prose is dropped, not the meaning.
 *
 * Two phrasings are recognised because the shaper emits both: the older
 * "dimmed on your screen" wording, and the current one that leads with the
 * lines and the shared colour.
 */
export function isPeripheralAnchor(text: string): boolean {
  return (
    /dimmed on your screen because they are not yours/i.test(text) ||
    /stop here too and are the same .* as yours/i.test(text)
  );
}

/**
 * The green globe is the one piece of NYC street furniture that means "subway
 * entrance" and nothing else, and the surveyor's cue names it when it is there.
 * Drawing it is worth more than the sentence describing it, so the entrance
 * hero checks before it draws something that might not be on that street.
 */
export function mentionsStreetGlobe(text: string): boolean {
  return /green globe|green lamp|globe or lamp/i.test(text);
}

/** The line a mezzanine or exit card is about, when the card itself does not carry a focus. */
export function lineFromInstruction(markdown: string): LineID | null {
  for (const phrase of boldPhrases(markdown)) {
    const candidate = phrase.trim().toUpperCase();
    if (isLineID(candidate)) return candidate;
  }
  return null;
}
