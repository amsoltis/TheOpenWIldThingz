import type {
  JourneyLeg,
  PaywallExceptionResponse,
  RecoveryResponse,
  RouteCard,
  TransitPacket,
  UserBillingProfile,
} from '@streetlevel/shared';
import { RECOVERY_CONFIDENCE_FLOOR } from '@streetlevel/shared';

/**
 * The whole interface is one linear deck plus three gates. There is no
 * navigation stack, no tab router and no back-history: a traveller who is
 * underground and anxious gets exactly three affordances — forward, backward,
 * and which trip they are on. Everything else is a modal interruption that
 * returns them to precisely where they were.
 *
 * Keeping that as a pure reducer (rather than scattered `useState`) is what
 * makes "you can never end up on a screen with no way out" a testable claim.
 */
export type ScreenId = 'PLANNING' | 'ENTRANCE_LOCK' | 'NAVIGATING' | 'RECOVERY' | 'PAYWALL';

export type LegKey = 'outbound' | 'return';

export interface LegProgress {
  cardIndex: number;
  /**
   * Per-leg, not global. The return trip starts from a different staircase on a
   * different corner, so confirming the outbound entrance must not silently
   * unlock the return deck.
   */
  entranceConfirmed: boolean;
}

export interface RecoverySession {
  response: RecoveryResponse;
  cardIndex: number;
}

export interface AppState {
  screen: ScreenId;
  packet: TransitPacket | null;
  activeLeg: LegKey;
  legs: Record<LegKey, LegProgress>;
  recovery: RecoverySession | null;
  paywall: PaywallExceptionResponse | null;
  /** Where an interruption (recovery / paywall) came from, so dismissal returns there. */
  interruptedScreen: ScreenId | null;
  isBusy: boolean;
  errorMessage: string | null;
  billing: UserBillingProfile | null;
  /**
   * Held separately from the packet because the paywall fires *before* a packet
   * exists, and the conversion copy has to name where they were trying to go.
   */
  intendedDestinationAddress: string | null;
}

export type AppAction =
  | { type: 'PACKET_REQUESTED'; destinationAddress: string }
  | { type: 'PACKET_RECEIVED'; packet: TransitPacket; billing: UserBillingProfile | null }
  | { type: 'PACKET_RESTORED'; packet: TransitPacket }
  | { type: 'REQUEST_FAILED'; message: string }
  | { type: 'ERROR_DISMISSED' }
  | { type: 'BILLING_UPDATED'; billing: UserBillingProfile }
  | { type: 'ENTRANCE_CONFIRMED' }
  | { type: 'CARD_NEXT' }
  | { type: 'CARD_PREV' }
  | { type: 'LEG_SELECTED'; leg: LegKey }
  | { type: 'RECOVERY_OPENED' }
  | { type: 'RECOVERY_REQUESTED' }
  | { type: 'RECOVERY_RESOLVED'; response: RecoveryResponse }
  | { type: 'RECOVERY_CLEARED' }
  | { type: 'RECOVERY_DISMISSED' }
  | { type: 'PAYWALL_RAISED'; response: PaywallExceptionResponse }
  | { type: 'PAYWALL_DISMISSED' }
  | { type: 'TRIP_RESET' };

export const packetRequested = (destinationAddress: string): AppAction => ({
  type: 'PACKET_REQUESTED',
  destinationAddress,
});
export const packetReceived = (
  packet: TransitPacket,
  billing: UserBillingProfile | null = null,
): AppAction => ({ type: 'PACKET_RECEIVED', packet, billing });
export const packetRestored = (packet: TransitPacket): AppAction => ({ type: 'PACKET_RESTORED', packet });
export const requestFailed = (message: string): AppAction => ({ type: 'REQUEST_FAILED', message });
export const errorDismissed = (): AppAction => ({ type: 'ERROR_DISMISSED' });
export const billingUpdated = (billing: UserBillingProfile): AppAction => ({ type: 'BILLING_UPDATED', billing });
export const entranceConfirmed = (): AppAction => ({ type: 'ENTRANCE_CONFIRMED' });
export const cardNext = (): AppAction => ({ type: 'CARD_NEXT' });
export const cardPrev = (): AppAction => ({ type: 'CARD_PREV' });
export const legSelected = (leg: LegKey): AppAction => ({ type: 'LEG_SELECTED', leg });
export const recoveryOpened = (): AppAction => ({ type: 'RECOVERY_OPENED' });
export const recoveryRequested = (): AppAction => ({ type: 'RECOVERY_REQUESTED' });
export const recoveryResolved = (response: RecoveryResponse): AppAction => ({
  type: 'RECOVERY_RESOLVED',
  response,
});
export const recoveryCleared = (): AppAction => ({ type: 'RECOVERY_CLEARED' });
export const recoveryDismissed = (): AppAction => ({ type: 'RECOVERY_DISMISSED' });
export const paywallRaised = (response: PaywallExceptionResponse): AppAction => ({
  type: 'PAYWALL_RAISED',
  response,
});
export const paywallDismissed = (): AppAction => ({ type: 'PAYWALL_DISMISSED' });
export const tripReset = (): AppAction => ({ type: 'TRIP_RESET' });

const freshLegs = (): Record<LegKey, LegProgress> => ({
  outbound: { cardIndex: 0, entranceConfirmed: false },
  return: { cardIndex: 0, entranceConfirmed: false },
});

export const initialAppState: AppState = {
  screen: 'PLANNING',
  packet: null,
  activeLeg: 'outbound',
  legs: freshLegs(),
  recovery: null,
  paywall: null,
  interruptedScreen: null,
  isBusy: false,
  errorMessage: null,
  billing: null,
  intendedDestinationAddress: null,
};

/* ------------------------------------------------------------------ *
 * Pure selectors — the deck's arithmetic, kept out of the components
 * ------------------------------------------------------------------ */

export function legOf(packet: TransitPacket | null, leg: LegKey): JourneyLeg | null {
  if (!packet) return null;
  return leg === 'outbound' ? packet.outboundJourney : packet.returnJourney;
}

export function activeLegOf(state: AppState): JourneyLeg | null {
  return legOf(state.packet, state.activeLeg);
}

/**
 * The cards currently under the finger. During recovery that is the recovery
 * deck, not the original trip — the original deck is stale the moment someone
 * admits they are lost.
 */
export function activeCards(state: AppState): RouteCard[] {
  if (state.screen === 'RECOVERY') {
    if (!state.recovery || !showsRecoveryRoute(state.recovery.response)) return [];
    return state.recovery.response.recoveryCards;
  }
  return activeLegOf(state)?.navigationCards ?? [];
}

export function activeCardIndex(state: AppState): number {
  if (state.screen === 'RECOVERY' && state.recovery) return state.recovery.cardIndex;
  return state.legs[state.activeLeg].cardIndex;
}

export function currentCard(state: AppState): RouteCard | undefined {
  return activeCards(state)[activeCardIndex(state)];
}

export function clampCardIndex(index: number, cardCount: number): number {
  if (cardCount <= 0) return 0;
  if (index < 0) return 0;
  if (index > cardCount - 1) return cardCount - 1;
  return Math.floor(index);
}

export function canGoNext(state: AppState): boolean {
  return activeCardIndex(state) < activeCards(state).length - 1;
}

export function canGoPrev(state: AppState): boolean {
  return activeCardIndex(state) > 0;
}

/**
 * The single most important predicate in the product. Under the floor the
 * engine is guessing, and a confidently wrong instruction to someone who is
 * already lost is worse than admitting we do not know where they are.
 */
export function showsRecoveryRoute(response: RecoveryResponse): boolean {
  return response.confidence >= RECOVERY_CONFIDENCE_FLOOR && response.recoveryCards.length > 0;
}

/** Whether the leg the traveller has selected still needs its corner confirmed. */
export function needsEntranceLock(state: AppState, leg: LegKey = state.activeLeg): boolean {
  return state.packet !== null && !state.legs[leg].entranceConfirmed;
}

function withLeg(state: AppState, leg: LegKey, patch: Partial<LegProgress>): AppState {
  return {
    ...state,
    legs: { ...state.legs, [leg]: { ...state.legs[leg], ...patch } },
  };
}

/* ------------------------------------------------------------------ *
 * Reducer
 * ------------------------------------------------------------------ */

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'PACKET_REQUESTED':
      return {
        ...state,
        isBusy: true,
        errorMessage: null,
        intendedDestinationAddress: action.destinationAddress,
      };

    case 'PACKET_RECEIVED':
      return {
        ...state,
        screen: 'ENTRANCE_LOCK',
        packet: action.packet,
        activeLeg: 'outbound',
        legs: freshLegs(),
        recovery: null,
        paywall: null,
        interruptedScreen: null,
        isBusy: false,
        errorMessage: null,
        billing: action.billing ?? state.billing,
        intendedDestinationAddress: action.packet.outboundJourney.destinationAddress,
      };

    // A packet read back off disk on cold start. Deliberately never touches
    // billing: an already-downloaded trip is readable forever, credits or not.
    case 'PACKET_RESTORED':
      return {
        ...state,
        screen: 'ENTRANCE_LOCK',
        packet: action.packet,
        activeLeg: 'outbound',
        legs: freshLegs(),
        recovery: null,
        isBusy: false,
        intendedDestinationAddress: action.packet.outboundJourney.destinationAddress,
      };

    case 'REQUEST_FAILED':
      return { ...state, isBusy: false, errorMessage: action.message };

    case 'ERROR_DISMISSED':
      return { ...state, errorMessage: null };

    case 'BILLING_UPDATED':
      return { ...state, billing: action.billing };

    case 'ENTRANCE_CONFIRMED': {
      if (!state.packet) return state;
      const confirmed = withLeg(state, state.activeLeg, { entranceConfirmed: true });
      return { ...confirmed, screen: 'NAVIGATING' };
    }

    case 'CARD_NEXT':
    case 'CARD_PREV': {
      const step = action.type === 'CARD_NEXT' ? 1 : -1;
      const cards = activeCards(state);
      const next = clampCardIndex(activeCardIndex(state) + step, cards.length);
      if (state.screen === 'RECOVERY') {
        if (!state.recovery) return state;
        return { ...state, recovery: { ...state.recovery, cardIndex: next } };
      }
      return withLeg(state, state.activeLeg, { cardIndex: next });
    }

    // Switching legs never clears the other leg's position: the traveller comes
    // back to their outbound trip mid-deck and expects to find their place.
    case 'LEG_SELECTED': {
      if (!state.packet || state.activeLeg === action.leg) return state;
      const screen: ScreenId = state.legs[action.leg].entranceConfirmed ? 'NAVIGATING' : 'ENTRANCE_LOCK';
      const target = legOf(state.packet, action.leg);
      return {
        ...state,
        activeLeg: action.leg,
        screen,
        recovery: null,
        interruptedScreen: null,
        intendedDestinationAddress: target?.destinationAddress ?? state.intendedDestinationAddress,
      };
    }

    case 'RECOVERY_OPENED':
      if (state.screen === 'RECOVERY') return state;
      return {
        ...state,
        screen: 'RECOVERY',
        interruptedScreen: state.screen,
        recovery: null,
        errorMessage: null,
      };

    case 'RECOVERY_REQUESTED':
      return { ...state, isBusy: true, errorMessage: null };

    case 'RECOVERY_RESOLVED':
      return {
        ...state,
        screen: 'RECOVERY',
        recovery: { response: action.response, cardIndex: 0 },
        isBusy: false,
        errorMessage: null,
      };

    /** Back to the "tell me what you can see" prompt to try a fuller description. */
    case 'RECOVERY_CLEARED':
      return { ...state, recovery: null, isBusy: false };

    case 'RECOVERY_DISMISSED': {
      const back = state.interruptedScreen ?? (state.packet ? 'NAVIGATING' : 'PLANNING');
      return { ...state, screen: back, interruptedScreen: null, recovery: null, isBusy: false };
    }

    case 'PAYWALL_RAISED':
      return {
        ...state,
        screen: 'PAYWALL',
        paywall: action.response,
        interruptedScreen: state.screen === 'PAYWALL' ? state.interruptedScreen : state.screen,
        isBusy: false,
        errorMessage: null,
      };

    // Dismissing the paywall must land somewhere usable. With a packet on disk
    // that is the deck they already own; without one it is the planner.
    case 'PAYWALL_DISMISSED': {
      const back = state.interruptedScreen ?? (state.packet ? 'NAVIGATING' : 'PLANNING');
      const landing: ScreenId = back === 'PAYWALL' ? (state.packet ? 'NAVIGATING' : 'PLANNING') : back;
      return { ...state, screen: landing, paywall: null, interruptedScreen: null };
    }

    case 'TRIP_RESET':
      return {
        ...initialAppState,
        billing: state.billing,
      };

    default:
      return state;
  }
}
