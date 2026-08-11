import type { JourneyLeg, LineID, RouteCard } from '@streetlevel/shared';

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
