/**
 * One statement per card.
 *
 * The statement zone is the size of a room and holds exactly one idea, so
 * something has to decide which idea that is. It is never the whole instruction
 * — "Ride 14 stops and get off at Eastern Pkwy-Brooklyn Museum" is a sentence
 * you read, and this zone is for the thing you see. The full instruction is
 * still spoken to screen readers and still printed in the enumeration below;
 * what is chosen here is only what gets to be four feet tall.
 *
 * Every value comes back out of the compiled packet. Nothing is invented: a
 * headline is allowed to be short, and it is not allowed to be a guess.
 */
import type { LineID, RouteCard } from '@streetlevel/shared';
import { isLineID } from '@streetlevel/shared';

import { boldPhrases, overheadSignLegends, stationNameFrom } from './cardFacts';

/** What the graphic bleeding off the right edge of the statement zone is. */
export type StatementGraphic = 'bullet' | 'counter' | 'exit' | 'connector';

export interface Statement {
  /** Which moment of the trip this is. Sits across the top. */
  kicker: string;
  /**
   * The statement, already broken into the lines it should set on. Broken here
   * rather than by the text engine because a statement that wraps where the
   * measuring happens to fall is not a statement, it is a paragraph.
   */
  headline: string[];
  /** The connective under the statement: "for the 3 toward". */
  sub?: string;
  /** The proper noun the statement is about, at a size worth matching a sign against. */
  name?: string;
  /** Legend for the black MTA plate, where this phase has a physical plate to match. */
  plate?: string;
  /** ON_TRAIN only: the count, given its own size because it is its own idea. */
  counter?: string;
  /**
   * One fact allowed to sit below a rule at the foot of the zone. Used for the
   * very next station, which is the only thing that can confirm — within two
   * minutes of the doors closing — that the right train was boarded.
   */
  footnote?: { label: string; value: string };
  graphic: StatementGraphic;
}

/**
 * The first emphasised phrase that is not a line bullet.
 *
 * The shaper bolds exactly the words carrying the decision — the line, and the
 * place. Reading it back this way is far steadier than pattern-matching the
 * prose around it, and it degrades to nothing rather than to a wrong name.
 */
export function placeFrom(markdown: string): string | null {
  for (const phrase of boldPhrases(markdown)) {
    if (!isLineID(phrase.trim().toUpperCase())) return phrase;
  }
  return null;
}

export function statementFor(card: RouteCard, line: LineID | null): Statement {
  switch (card.phaseType) {
    case 'ENTRANCE_APPROACH': {
      const station = stationNameFrom(card.visualAnchors) ?? placeFrom(card.primaryInstructionMarkdown);
      return {
        kicker: 'GETTING TO THE STAIRS',
        headline: ['FIND', 'THIS'],
        sub: 'walk to',
        ...(station ? { name: station } : {}),
        graphic: 'bullet',
      };
    }

    case 'MEZZANINE_TRANSIT': {
      // A connector has no bullet and no overhead sign in our data, so the
      // ordinary treatment left "follow the signs to" pointing at nothing.
      // Name the service instead — it is what is written on the doors.
      if (card.connectorFocus) {
        const { connectorName, signpostedAs } = card.connectorFocus;
        return {
          kicker: 'LEAVING THE SUBWAY',
          headline: ['THIS', 'WAY'],
          sub: 'walk to the',
          name: connectorName,
          plate: signpostedAs.toUpperCase(),
          graphic: 'connector',
        };
      }
      const legend = overheadSignLegends(card.visualAnchors)[0] ?? null;
      return {
        kicker: 'INSIDE THE STATION',
        headline: ['THIS', 'WAY'],
        sub: 'follow the signs to',
        ...(legend ? { name: legend, plate: legend.toUpperCase() } : {}),
        graphic: 'bullet',
      };
    }

    case 'PLATFORM_WAIT': {
      const headsign = placeFrom(card.primaryInstructionMarkdown) ?? headsignFrom(card.visualAnchors);
      return {
        kicker: 'WAITING FOR YOUR TRAIN',
        headline: ['WAIT', 'HERE'],
        sub: line ? `for the ${line} toward` : 'for your train toward',
        ...(headsign ? { name: headsign, plate: headsign.toUpperCase() } : {}),
        graphic: 'bullet',
      };
    }

    case 'ON_TRAIN': {
      // No stops to count, so the counter — the whole point of this layout —
      // has nothing to say. Showing "0 STOPS TO GO" beside a river crossing
      // would read as an error.
      if (card.connectorFocus) {
        const ladder = card.stopLadder;
        const alight = ladder?.stops[ladder.alightIndex] ?? null;
        return {
          kicker: 'ON THE ' + card.connectorFocus.signpostedAs.toUpperCase(),
          headline: ['ONE', 'RIDE'],
          sub: 'all the way to',
          ...(alight ? { name: alight } : {}),
          graphic: 'connector',
        };
      }
      const ladder = card.stopLadder;
      const count = ladder ? Math.max(ladder.alightIndex, 0) : (card.offlineSensorValidation?.expectedTunnelTransitCount ?? 0);
      const alight = ladder?.stops[ladder.alightIndex] ?? placeFrom(card.primaryInstructionMarkdown);
      const next = ladder?.stops[1] ?? card.offlineSensorValidation?.expectedNextStationNodeName ?? null;
      return {
        kicker: 'ON THE TRAIN',
        headline: ['STOPS', 'TO GO'],
        counter: String(count),
        sub: 'get off at',
        ...(alight ? { name: alight } : {}),
        ...(next ? { footnote: { label: 'NEXT STOP', value: next } } : {}),
        graphic: 'counter',
      };
    }

    case 'EXIT_SURFACING': {
      const station = placeFrom(card.primaryInstructionMarkdown);
      return {
        kicker: 'COMING BACK UP',
        headline: ['UP AND', 'OUT'],
        sub: 'leave the station at',
        ...(station ? { name: station } : {}),
        plate: 'EXIT',
        graphic: 'exit',
      };
    }
  }
}

const HEADSIGN_ON_TRAIN_FRONT = /reads "([^"]+)"/i;

/**
 * What is painted on the front of the train, as the surveyor recorded it. Used
 * only as the fallback when the instruction carried no emphasis to read.
 */
export function headsignFrom(texts: readonly string[]): string | null {
  for (const text of texts) {
    const match = HEADSIGN_ON_TRAIN_FRONT.exec(text);
    if (match?.[1]) return match[1];
  }
  return null;
}
