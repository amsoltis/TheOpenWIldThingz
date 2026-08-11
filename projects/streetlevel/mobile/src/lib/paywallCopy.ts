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

export function downloadedTripsReassurance(downloadedTripCount: number): string {
  if (downloadedTripCount <= 0) {
    return 'Any trip you have already downloaded stays on this phone and stays readable, with or without a purchase.';
  }
  const noun = downloadedTripCount === 1 ? 'trip' : 'trips';
  return `The ${downloadedTripCount} ${noun} already on this phone stay yours. They open offline, forever, whether or not you buy anything today.`;
}
