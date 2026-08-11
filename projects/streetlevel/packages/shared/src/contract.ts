/**
 * The wire contract between the data-shaping backend and the Expo client.
 *
 * These types are the spec's types. Do not "improve" them casually: the server
 * serialises to this shape and the client's state machine binds to it directly,
 * so a change here is a breaking protocol change on both sides at once. That
 * bidirectional breakage is the point — it is how a server-side payload change
 * surfaces as a client compile error instead of a crash 60 feet underground.
 */

export type LineID =
  | '1' | '2' | '3' | '4' | '5' | '6' | '7'
  | 'A' | 'C' | 'E'
  | 'B' | 'D' | 'F' | 'M'
  | 'G'
  | 'J' | 'Z'
  | 'L'
  | 'N' | 'Q' | 'R' | 'W'
  | 'S';

export type HexColor = string;
export type StationID = string;

export interface TransitPacket {
  packetId: string;
  compiledAt: string;
  expiresAt: string;
  isMaintenanceDiverted: boolean;
  outboundJourney: JourneyLeg;
  returnJourney: JourneyLeg;
}

export interface JourneyLeg {
  originAddress: string;
  destinationAddress: string;
  plannedDepartureWindow: string;
  totalEstimatedDurationMinutes: number;
  initialStreetEntrance: StreetEntranceNode;
  navigationCards: RouteCard[];
}

export interface StreetEntranceNode {
  entranceId: string;
  associatedStationId: StationID;
  streetIntersectionText: string;
  geographicCornerCode: 'NW' | 'NE' | 'SW' | 'SE';
  visualLandmarkCue: string;
  avoidanceWarningText?: string;
  latitude: number;
  longitude: number;
}

export type PhaseType =
  | 'ENTRANCE_APPROACH'
  | 'MEZZANINE_TRANSIT'
  | 'PLATFORM_WAIT'
  | 'ON_TRAIN'
  | 'EXIT_SURFACING';

/**
 * How much hand-holding this traveller wants.
 *
 * Not an accessibility setting and not a preference buried in a menu — it is
 * the difference between two genuinely different products sharing one engine.
 * Somebody on their first ever subway ride needs to be shown what to look for;
 * somebody who has done this trip twice wants the line and the direction and
 * nothing else, and will resent every extra word.
 *
 * Crucially this is a *rendering* decision, not a routing one. The packet is
 * compiled once, carries every level, and the client switches between them
 * offline — because the moment a traveller wants less detail is usually the
 * moment they are already underground.
 */
export type Proficiency = 'FIRST_TIME' | 'BEEN_HERE' | 'LOCAL';

export const PROFICIENCY_ORDER: readonly Proficiency[] = ['FIRST_TIME', 'BEEN_HERE', 'LOCAL'];

export interface RouteCard {
  cardId: string;
  phaseOrder: number;
  phaseType: PhaseType;
  primaryInstructionMarkdown: string;
  /**
   * The same instruction for somebody who does not need it explained — one
   * line, the load-bearing facts only. Shown at LOCAL.
   */
  conciseInstructionMarkdown?: string;
  targetLineFocus?: LineFocusConfig;
  /** Mutually exclusive with `targetLineFocus`: a connector has no line. */
  connectorFocus?: ConnectorFocusConfig;
  visualAnchors: string[];
  criticalAvoidanceNotes?: string;
  hapticPatternTrigger?: 'LIGHT_TAP' | 'DOUBLE_JOLT' | 'CONTINUOUS_ALERT';
  offlineSensorValidation?: SensorValidationConfig;
  /** Present on ON_TRAIN cards. The stops, named and in order. */
  stopLadder?: StopLadder;
}

/**
 * Every stop the train makes on one leg.
 *
 * "Ride 14 stops" is the most anxious sentence in the product: it asks someone
 * to hold a count in their head, in a language they may not read, while a train
 * they are not sure about carries them somewhere they have never been. Naming
 * the stops turns that count into a checklist they can tick off against the
 * signs going past — the same reassurance a local gets for free from knowing
 * the line.
 */
export interface StopLadder {
  /** In order: the stop boarded at, every stop between, and the stop to get off at. */
  stops: string[];
  /** Index into `stops` of the station to leave the train at. */
  alightIndex: number;
  /**
   * Stations the train runs through without stopping, keyed by the index of
   * the stop they come before. Express riders watch these fly past and need to
   * know that is expected rather than a missed stop.
   */
  passedThrough?: Record<string, string[]>;
}

export interface LineFocusConfig {
  activeLineId: LineID;
  activeLineColor: HexColor;
  coLocatedLinesToDim: LineID[];
  /** 1-indexed from the front of the train. */
  expectedTrainCarIndex: number;
  platformPositioningText: string;
}

/**
 * The card is about a fare-linked service that is not a subway line.
 *
 * Without this the client has nothing to go on: a card with no
 * `targetLineFocus` falls back to the nearest train in the deck, so a card
 * about the Roosevelt Island Tramway came out painted Broadway yellow with a
 * **W** bullet on it — telling somebody to look for a train on their way to a
 * cable car. The packet has to be able to say "this one is not a train",
 * because the client is offline and cannot ask.
 */
export interface ConnectorFocusConfig {
  connectorName: string;
  /**
   * Deliberately not any line's colour. A rider who has learnt that a colour
   * means a train must not meet one that does not.
   */
  connectorColor: HexColor;
  /** Ink that stays legible on `connectorColor`. */
  connectorTextColor: HexColor;
  /** The short word on the signs, e.g. "Tramway". */
  signpostedAs: string;
}

export interface SensorValidationConfig {
  expectedTunnelTransitCount: number;
  expectedNextStationNodeName: string;
  targetBleBeaconUuidString?: string;
}

/* ------------------------------------------------------------------ *
 * Billing / metering
 * ------------------------------------------------------------------ */

export interface UserBillingProfile {
  deviceId: string;
  creditsRemaining: number;
  isPremiumUnlocked: boolean;
  registrationDate: string;
}

export interface PaywallSku {
  /** iOS App Store / Android Google Play product ID. */
  platformSkuString: string;
  /** e.g. "$4.99" */
  localizedPriceText: string;
  tierDescription: string;
}

export interface PaywallExceptionResponse {
  statusCode: 402;
  errorType: 'QUOTA_EXHAUSTED';
  message: string;
  targetSkus: PaywallSku[];
}

/* ------------------------------------------------------------------ *
 * Request shapes
 * ------------------------------------------------------------------ */

export interface PacketRequest {
  originAddress: string;
  destinationAddress: string;
  /** ISO-8601. Departure time for the outbound leg. */
  departAt: string;
  /**
   * ISO-8601. When the traveller intends to head home. The Predictive
   * Divergence Engine checks the alert feed against *this* window, not the
   * outbound one — a return leg at 1am is a different subway system.
   */
  returnAt: string;
}

export interface RecoveryRequest {
  /** Free text: whatever the traveller can see on the walls around them. */
  surroundingsDescription: string;
  /** The packet they were following when they got lost, if any. */
  activePacketId?: string;
  /** Where they were ultimately trying to get to. */
  intendedDestinationAddress?: string;
}

export interface RecoveryResponse {
  /** Best guess at where they are standing right now. */
  resolvedStationId: StationID;
  resolvedStationName: string;
  resolvedPlatformDirection?: string;
  /** 0..1. Below `RECOVERY_CONFIDENCE_FLOOR` the client must ask for more detail. */
  confidence: number;
  /** Why the engine thinks this — shown to the traveller so they can sanity-check it. */
  reasoningPlainText: string;
  /** A fresh card deck from where they actually are to where they meant to go. */
  recoveryCards: RouteCard[];
  /** Set when confidence is too low to route: the client should ask these. */
  clarifyingQuestions?: string[];
}

/**
 * Below this confidence the engine must not silently invent a route — a
 * confidently wrong instruction to an already-lost tourist is the single worst
 * failure this product can have.
 */
export const RECOVERY_CONFIDENCE_FLOOR = 0.45;

/* ------------------------------------------------------------------ *
 * Service alerts (the Predictive Divergence Engine's input)
 * ------------------------------------------------------------------ */

export interface ServiceAlert {
  alertId: string;
  affectedLineIds: LineID[];
  affectedStationIds: StationID[];
  /** ISO-8601 window during which the disruption applies. */
  activeFrom: string;
  activeUntil: string;
  effect: 'NO_SERVICE' | 'DETOUR' | 'STATION_BYPASS' | 'REDUCED_SERVICE';
  headerPlainText: string;
}
