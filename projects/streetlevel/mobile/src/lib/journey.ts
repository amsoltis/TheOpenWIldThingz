import type { JourneyLeg, LineID, RouteCard } from '@streetlevel/shared';

import { lineFromInstruction } from './cardFacts';

/**
 * The line a leg is "about", used to tint the entrance diagram and the deck
 * chrome. Taking it from the first card that names one means the colour on the
 * lock screen is the colour of the bullet the traveller is about to look for
 * underground, rather than an arbitrary brand accent.
 */
export function primaryLineOf(leg: JourneyLeg | null): LineID | null {
  if (!leg) return null;
  for (const card of leg.navigationCards) {
    if (card.targetLineFocus) return card.targetLineFocus.activeLineId;
  }
  return null;
}

/** Cards in the order the traveller walks them, regardless of array order. */
export function orderedCards(leg: JourneyLeg | null): RouteCard[] {
  if (!leg) return [];
  return [...leg.navigationCards].sort((a, b) => a.phaseOrder - b.phaseOrder);
}

export function legDurationText(leg: JourneyLeg | null): string {
  if (!leg) return '';
  const minutes = leg.totalEstimatedDurationMinutes;
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return hours === 1 ? 'about an hour' : `about ${hours} hours`;
  return `about ${hours} h ${rest} min`;
}

/**
 * Which line each card belongs to.
 *
 * Only PLATFORM_WAIT carries a `targetLineFocus`, but the cards either side of
 * it are just as much "about" that train: the mezzanine card is the walk to its
 * platform, the on-train card is the ride itself. Resolving that here is what
 * lets a mezzanine sign show the right bullet and lets the ribbon know where
 * one train ends and the next begins.
 *
 * Street walking — the approach and the surfacing — belongs to no line, which
 * is the honest answer and also the useful one: those are the two moments the
 * traveller is above ground.
 */
export function cardLines(cards: readonly RouteCard[]): (LineID | null)[] {
  const direct = cards.map((card) => card.targetLineFocus?.activeLineId ?? null);

  return cards.map((card, index) => {
    const own = direct[index];
    if (own) return own;
    // A connector is not a train and must never borrow one. Falling through
    // here painted the Roosevelt Island Tramway card Broadway yellow and put a
    // W bullet on it, which is an instruction to look for the wrong thing.
    if (card.connectorFocus) return null;
    if (card.phaseType === 'ON_TRAIN') {
      for (let i = index - 1; i >= 0; i -= 1) {
        const line = direct[i];
        if (line) return line;
      }
      return null;
    }
    if (card.phaseType === 'MEZZANINE_TRANSIT') {
      for (let i = index + 1; i < cards.length; i += 1) {
        const line = direct[i];
        if (line) return line;
      }
      // A mezzanine card with no platform after it is a walk out through the
      // station, so fall back to the train just left rather than showing none.
      return lineFromInstruction(card.primaryInstructionMarkdown);
    }
    return null;
  });
}

export interface SpineSegment {
  kind: 'walk' | 'ride';
  line: LineID | null;
  /** Index of the first card in this segment, in the ordered deck. */
  from: number;
  /** Index of the last card in this segment, inclusive. */
  to: number;
  /** Stops ridden on this segment. Zero for walks and for rides with no ladder. */
  stopCount: number;
}

/**
 * The journey as a shape: walk, ride, transfer, ride, walk.
 *
 * A deck of cards answers "what do I do now" and answers "how much of this is
 * left" not at all. Someone four stops into a fourteen-stop ride with no signal
 * is holding a question the card cannot answer, and the shape does: the ribbon
 * built from this is the only place the whole trip is visible at once.
 */
export function journeySpine(cards: readonly RouteCard[]): SpineSegment[] {
  const lines = cardLines(cards);
  const segments: SpineSegment[] = [];

  cards.forEach((card, index) => {
    const line = lines[index] ?? null;
    const kind = line ? 'ride' : 'walk';
    const open = segments[segments.length - 1];
    const stops = card.stopLadder ? Math.max(card.stopLadder.stops.length - 1, 0) : 0;

    if (open && open.kind === kind && open.line === line) {
      open.to = index;
      open.stopCount = Math.max(open.stopCount, stops);
      return;
    }
    segments.push({ kind, line, from: index, to: index, stopCount: stops });
  });

  return segments;
}

/**
 * How much horizontal room a segment gets in the ribbon.
 *
 * Weighted by stops so the fourteen-stop ride reads as the long part of the
 * afternoon that it is, but clamped at both ends: a walk still has to be wide
 * enough to be seen, and a forty-stop ride must not squeeze the walks away.
 */
export function segmentWeight(segment: SpineSegment): number {
  if (segment.kind === 'walk') return 3;
  return Math.min(Math.max(segment.stopCount, 5), 18);
}
