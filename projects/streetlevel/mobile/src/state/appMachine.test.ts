import { describe, expect, it } from 'vitest';
import type {
  JourneyLeg,
  PaywallExceptionResponse,
  RecoveryResponse,
  RouteCard,
  StreetEntranceNode,
  TransitPacket,
  UserBillingProfile,
} from '@streetlevel/shared';
import { RECOVERY_CONFIDENCE_FLOOR } from '@streetlevel/shared';

import {
  activeCardIndex,
  activeCards,
  appReducer,
  canGoNext,
  canGoPrev,
  cardNext,
  cardPrev,
  clampCardIndex,
  currentCard,
  entranceConfirmed,
  initialAppState,
  legSelected,
  needsEntranceLock,
  packetReceived,
  packetRequested,
  packetRestored,
  paywallDismissed,
  paywallRaised,
  recoveryCleared,
  recoveryDismissed,
  recoveryOpened,
  recoveryResolved,
  requestFailed,
  showsRecoveryRoute,
  tripReset,
} from './appMachine';
import type { AppState } from './appMachine';

function card(order: number, id = `card-${order}`): RouteCard {
  return {
    cardId: id,
    phaseOrder: order,
    phaseType: 'MEZZANINE_TRANSIT',
    primaryInstructionMarkdown: `Step ${order}`,
    visualAnchors: [],
  };
}

const entrance: StreetEntranceNode = {
  entranceId: 'ENT-1',
  associatedStationId: '127',
  streetIntersectionText: '7 Av at W 42 St',
  geographicCornerCode: 'SE',
  visualLandmarkCue: 'The stair beneath the big screens.',
  latitude: 40.7553,
  longitude: -73.9871,
};

function leg(destination: string, cardCount: number): JourneyLeg {
  return {
    originAddress: 'Origin',
    destinationAddress: destination,
    plannedDepartureWindow: '2026-08-11T13:00:00.000Z',
    totalEstimatedDurationMinutes: 24,
    initialStreetEntrance: entrance,
    navigationCards: Array.from({ length: cardCount }, (_, i) => card(i + 1)),
  };
}

const packet: TransitPacket = {
  packetId: 'pkt-1',
  compiledAt: '2026-08-11T12:00:00.000Z',
  expiresAt: '2026-08-12T12:00:00.000Z',
  isMaintenanceDiverted: false,
  outboundJourney: leg('The Morgan Library', 4),
  returnJourney: leg('Hotel', 3),
};

const billing: UserBillingProfile = {
  deviceId: 'device-1',
  creditsRemaining: 2,
  isPremiumUnlocked: false,
  registrationDate: '2026-08-01T00:00:00.000Z',
};

const paywall: PaywallExceptionResponse = {
  statusCode: 402,
  errorType: 'QUOTA_EXHAUSTED',
  message: 'Out of keys.',
  targetSkus: [{ platformSkuString: 'lifetime', localizedPriceText: '$4.99', tierDescription: 'Lifetime' }],
};

function navigating(): AppState {
  let state = appReducer(initialAppState, packetReceived(packet, billing));
  state = appReducer(state, entranceConfirmed());
  return state;
}

describe('clampCardIndex', () => {
  it('keeps an index inside the deck', () => {
    expect(clampCardIndex(-3, 4)).toBe(0);
    expect(clampCardIndex(0, 4)).toBe(0);
    expect(clampCardIndex(3, 4)).toBe(3);
    expect(clampCardIndex(9, 4)).toBe(3);
  });

  it('collapses to zero for an empty deck rather than returning -1', () => {
    expect(clampCardIndex(0, 0)).toBe(0);
    expect(clampCardIndex(5, 0)).toBe(0);
  });
});

describe('packet intake', () => {
  it('opens the entrance lock before any card is reachable', () => {
    const state = appReducer(initialAppState, packetReceived(packet, billing));
    expect(state.screen).toBe('ENTRANCE_LOCK');
    expect(state.legs.outbound.entranceConfirmed).toBe(false);
    expect(state.legs.return.entranceConfirmed).toBe(false);
    expect(needsEntranceLock(state)).toBe(true);
  });

  it('records the destination for the paywall copy at request time', () => {
    const state = appReducer(initialAppState, packetRequested('The Morgan Library'));
    expect(state.isBusy).toBe(true);
    expect(state.intendedDestinationAddress).toBe('The Morgan Library');
  });

  it('restores a stored packet without touching billing', () => {
    const withBilling = appReducer(initialAppState, packetReceived(packet, billing));
    const reset = appReducer(withBilling, tripReset());
    const restored = appReducer(reset, packetRestored(packet));
    expect(restored.screen).toBe('ENTRANCE_LOCK');
    expect(restored.billing).toEqual(billing);
  });

  it('clears busy state and surfaces the message on failure', () => {
    const requesting = appReducer(initialAppState, packetRequested('Somewhere'));
    const failed = appReducer(requesting, requestFailed('No route.'));
    expect(failed.isBusy).toBe(false);
    expect(failed.errorMessage).toBe('No route.');
  });
});

describe('deck movement', () => {
  it('advances and reverses within bounds', () => {
    let state = navigating();
    expect(activeCardIndex(state)).toBe(0);
    expect(canGoPrev(state)).toBe(false);

    state = appReducer(state, cardNext());
    expect(activeCardIndex(state)).toBe(1);
    expect(currentCard(state)?.cardId).toBe('card-2');

    state = appReducer(state, cardPrev());
    expect(activeCardIndex(state)).toBe(0);
  });

  it('never walks off either end of the deck', () => {
    let state = navigating();
    for (let i = 0; i < 10; i += 1) state = appReducer(state, cardNext());
    expect(activeCardIndex(state)).toBe(3);
    expect(canGoNext(state)).toBe(false);

    for (let i = 0; i < 10; i += 1) state = appReducer(state, cardPrev());
    expect(activeCardIndex(state)).toBe(0);
    expect(canGoPrev(state)).toBe(false);
  });
});

describe('leg toggling', () => {
  it('locks the return entrance separately from the outbound one', () => {
    const state = appReducer(navigating(), legSelected('return'));
    expect(state.activeLeg).toBe('return');
    expect(state.screen).toBe('ENTRANCE_LOCK');
    expect(needsEntranceLock(state)).toBe(true);
    expect(state.intendedDestinationAddress).toBe('Hotel');
  });

  it('keeps each leg on the card it was left on', () => {
    let state = navigating();
    state = appReducer(state, cardNext());
    state = appReducer(state, cardNext());
    expect(activeCardIndex(state)).toBe(2);

    state = appReducer(state, legSelected('return'));
    state = appReducer(state, entranceConfirmed());
    state = appReducer(state, cardNext());
    expect(activeCardIndex(state)).toBe(1);

    state = appReducer(state, legSelected('outbound'));
    expect(state.screen).toBe('NAVIGATING');
    expect(activeCardIndex(state)).toBe(2);
    expect(activeCards(state)).toHaveLength(4);
  });

  it('ignores a toggle to the leg already showing', () => {
    const state = navigating();
    expect(appReducer(state, legSelected('outbound'))).toBe(state);
  });

  it('ignores a toggle before any packet exists', () => {
    expect(appReducer(initialAppState, legSelected('return'))).toBe(initialAppState);
  });
});

describe('recovery', () => {
  const confident: RecoveryResponse = {
    resolvedStationId: '127',
    resolvedStationName: 'Times Sq-42 St',
    confidence: 0.9,
    reasoningPlainText: 'You described the shuttle passage.',
    recoveryCards: [card(1, 'r-1'), card(2, 'r-2')],
  };

  const unsure: RecoveryResponse = {
    resolvedStationId: '127',
    resolvedStationName: 'Times Sq-42 St',
    confidence: RECOVERY_CONFIDENCE_FLOOR - 0.01,
    reasoningPlainText: 'Too many stations match tiled walls.',
    recoveryCards: [card(1, 'r-1')],
    clarifyingQuestions: ['What does the nearest sign say?'],
  };

  it('routes only at or above the confidence floor', () => {
    expect(showsRecoveryRoute(confident)).toBe(true);
    expect(showsRecoveryRoute(unsure)).toBe(false);
    expect(showsRecoveryRoute({ ...confident, confidence: RECOVERY_CONFIDENCE_FLOOR })).toBe(true);
  });

  it('shows no cards at all when the engine is unsure', () => {
    const state = appReducer(appReducer(navigating(), recoveryOpened()), recoveryResolved(unsure));
    expect(activeCards(state)).toHaveLength(0);
    expect(currentCard(state)).toBeUndefined();
  });

  it('drives the recovery deck rather than the trip deck', () => {
    let state = appReducer(appReducer(navigating(), recoveryOpened()), recoveryResolved(confident));
    expect(activeCards(state).map((c) => c.cardId)).toEqual(['r-1', 'r-2']);

    state = appReducer(state, cardNext());
    expect(state.recovery?.cardIndex).toBe(1);
    expect(state.legs.outbound.cardIndex).toBe(0);

    state = appReducer(state, cardNext());
    expect(state.recovery?.cardIndex).toBe(1);
  });

  it('returns to the screen the traveller came from', () => {
    const opened = appReducer(navigating(), recoveryOpened());
    expect(opened.interruptedScreen).toBe('NAVIGATING');
    const dismissed = appReducer(appReducer(opened, recoveryResolved(confident)), recoveryDismissed());
    expect(dismissed.screen).toBe('NAVIGATING');
    expect(dismissed.recovery).toBeNull();
  });

  it('can drop the answer and ask again without leaving recovery', () => {
    const resolved = appReducer(appReducer(navigating(), recoveryOpened()), recoveryResolved(confident));
    const again = appReducer(resolved, recoveryCleared());
    expect(again.screen).toBe('RECOVERY');
    expect(again.recovery).toBeNull();
  });

  it('opens from the entrance lock too', () => {
    const locked = appReducer(initialAppState, packetReceived(packet, billing));
    const opened = appReducer(locked, recoveryOpened());
    expect(opened.interruptedScreen).toBe('ENTRANCE_LOCK');
    expect(appReducer(opened, recoveryDismissed()).screen).toBe('ENTRANCE_LOCK');
  });
});

describe('402 handling', () => {
  it('mounts the paywall and remembers where it interrupted', () => {
    const planning = appReducer(initialAppState, packetRequested('The Morgan Library'));
    const walled = appReducer(planning, paywallRaised(paywall));
    expect(walled.screen).toBe('PAYWALL');
    expect(walled.paywall).toEqual(paywall);
    expect(walled.isBusy).toBe(false);
    expect(walled.intendedDestinationAddress).toBe('The Morgan Library');
  });

  it('lands on the planner when dismissed with no downloaded trip', () => {
    const walled = appReducer(appReducer(initialAppState, packetRequested('X')), paywallRaised(paywall));
    const dismissed = appReducer(walled, paywallDismissed());
    expect(dismissed.screen).toBe('PLANNING');
    expect(dismissed.paywall).toBeNull();
  });

  it('returns a paying-out-of-credit traveller to the trip they already own', () => {
    const walled = appReducer(navigating(), paywallRaised(paywall));
    const dismissed = appReducer(walled, paywallDismissed());
    expect(dismissed.screen).toBe('NAVIGATING');
    expect(dismissed.packet).toEqual(packet);
    expect(activeCards(dismissed)).toHaveLength(4);
  });

  it('does not lose the original interruption point if a second 402 arrives', () => {
    const walled = appReducer(navigating(), paywallRaised(paywall));
    const again = appReducer(walled, paywallRaised({ ...paywall, message: 'Still out.' }));
    expect(again.interruptedScreen).toBe('NAVIGATING');
    expect(appReducer(again, paywallDismissed()).screen).toBe('NAVIGATING');
  });
});

describe('trip reset', () => {
  it('clears the trip but keeps the meter reading', () => {
    const state = appReducer(navigating(), tripReset());
    expect(state.screen).toBe('PLANNING');
    expect(state.packet).toBeNull();
    expect(state.billing).toEqual(billing);
  });
});
