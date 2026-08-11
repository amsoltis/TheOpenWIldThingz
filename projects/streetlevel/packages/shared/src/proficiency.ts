import type { Proficiency, RouteCard } from './contract.js';

/**
 * Reducing a card to what one traveller actually wants to read.
 *
 * Lives in the shared contract rather than in the client because it decides
 * what a person is shown, and that decision has to be testable somewhere the
 * tests can reach. It is a pure function of the card: no network, no state, so
 * switching level works sixty feet underground with the radio off.
 */

export interface RenderedCard {
  instruction: string;
  /** In the order the compiler emitted them: most useful first. */
  anchors: string[];
  /** Present whenever the card carries one — see the note below. */
  avoidance?: string;
  /** Whether the client should draw the full scaffolding: diagrams, ladders, highlighting. */
  showScaffolding: boolean;
}

/**
 * How many supporting details survive at each level.
 *
 * The compiler orders `visualAnchors` by usefulness, so truncating from the end
 * degrades gracefully: the traveller loses the nice-to-know before the
 * need-to-know.
 */
const ANCHOR_BUDGET: Record<Proficiency, number> = {
  FIRST_TIME: Number.POSITIVE_INFINITY,
  BEEN_HERE: 2,
  LOCAL: 0,
};

export function renderForProficiency(card: RouteCard, level: Proficiency): RenderedCard {
  const instruction =
    level === 'LOCAL' && card.conciseInstructionMarkdown?.trim()
      ? card.conciseInstructionMarkdown
      : card.primaryInstructionMarkdown;

  const budget = ANCHOR_BUDGET[level];
  const anchors = Number.isFinite(budget) ? card.visualAnchors.slice(0, budget) : [...card.visualAnchors];

  const rendered: RenderedCard = {
    instruction,
    anchors,
    showScaffolding: level === 'FIRST_TIME',
  };

  /**
   * The prohibition survives every level, including LOCAL.
   *
   * It is tempting to treat "do not board the first train unless the sign reads
   * New Lots Av" as beginner content, but the mistakes it prevents are not
   * beginner mistakes — a local boards the wrong train precisely because they
   * stopped reading. It is one short sentence and it is the only thing on the
   * card that exists to stop something going wrong, so it is never the thing we
   * economise on.
   */
  if (card.criticalAvoidanceNotes) rendered.avoidance = card.criticalAvoidanceNotes;

  return rendered;
}

/** Cycles through the levels for a single-control toggle. */
export function nextProficiency(level: Proficiency): Proficiency {
  switch (level) {
    case 'FIRST_TIME':
      return 'BEEN_HERE';
    case 'BEEN_HERE':
      return 'LOCAL';
    case 'LOCAL':
      return 'FIRST_TIME';
  }
}

export const PROFICIENCY_LABELS: Record<Proficiency, { name: string; blurb: string }> = {
  FIRST_TIME: {
    name: 'First time',
    blurb: 'Show me everything — what to look for, and what not to do.',
  },
  BEEN_HERE: {
    name: "I've done this",
    blurb: 'The instruction and the key detail. Skip the explanations.',
  },
  LOCAL: {
    name: 'Just the line',
    blurb: 'Line, direction, stops. Nothing else.',
  },
};
