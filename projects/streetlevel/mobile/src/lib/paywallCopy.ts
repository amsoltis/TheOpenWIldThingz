/**
 * Conversion copy that names the trip in front of them.
 *
 * A generic "upgrade to premium" wall asks someone to buy an abstraction. This
 * one asks them to buy the thing they were two taps away from receiving, by
 * name, at the moment they want it. Everything here stays honest: the trips
 * they already downloaded keep working whether or not they pay, and the copy
 * says so out loud rather than letting the wall imply otherwise.
 */

export function paywallHeadline(freeAllowance: number): string {
  if (freeAllowance === 1) return "You've used your free navigation key.";
  return `You've used your ${freeAllowance} free navigation keys.`;
}

export function paywallSubline(destination: string | null): string {
  const target = destination && destination.trim().length > 0 ? destination.trim() : 'your next stop';
  return `Unlock lifetime access to instantly open your custom, offline walkthrough to ${target}.`;
}

/**
 * Splits a store tier description into a product name and what it actually
 * buys. The stores hand us one long line — "City Explorer Pass — unlimited
 * offline trip packets, one payment, no subscription" — and set as one block it
 * reads as small print. Split at the dash it is a product with a promise under
 * it, which is what someone deciding whether to spend five dollars is looking
 * for. A description with no dash is left whole rather than cut somewhere the
 * store did not intend.
 */
export function splitTierDescription(tierDescription: string): {
  name: string;
  detail: string | null;
} {
  const text = tierDescription.trim();
  if (text.length === 0) return { name: 'Lifetime access', detail: null };
  const match = /^(.+?)\s+[—–-]\s+(.+)$/.exec(text);
  if (!match?.[1] || !match[2]) return { name: text, detail: null };
  return { name: match[1], detail: match[2].replace(/\.$/, '') };
}

/**
 * The server's own message, only when it says something the local copy has not.
 * The two agree almost always — and printing the same sentence twice, once
 * large and once grey, makes a paywall look like it was assembled rather than
 * written.
 */
export function serverMessageWorthShowing(
  message: string,
  headline: string,
  subline: string,
): string | null {
  const text = message.trim();
  if (text.length === 0) return null;
  const normalise = (s: string): string => s.replace(/\s+/g, ' ').trim();
  const flat = normalise(text);
  if (flat.includes(normalise(headline)) || flat.includes(normalise(subline))) return null;
  return text;
}

export function downloadedTripsReassurance(downloadedTripCount: number): string {
  if (downloadedTripCount <= 0) {
    return 'Any trip you have already downloaded stays on this phone and stays readable, with or without a purchase.';
  }
  const noun = downloadedTripCount === 1 ? 'trip' : 'trips';
  return `The ${downloadedTripCount} ${noun} already on this phone stay yours. They open offline, forever, whether or not you buy anything today.`;
}
