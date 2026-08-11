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

export interface RouteCard {
  cardId: string;
  phaseOrder: number;
  phaseType: PhaseType;
  primaryInstructionMarkdown: string;
  targetLineFocus?: LineFocusConfig;
  visualAnchors: string[];
  criticalAvoidanceNotes?: string;
  hapticPatternTrigger?: 'LIGHT_TAP' | 'DOUBLE_JOLT' | 'CONTINUOUS_ALERT';
  offlineSensorValidation?: SensorValidationConfig;
}

export interface LineFocusConfig {
  activeLineId: LineID;
  activeLineColor: HexColor;
  coLocatedLinesToDim: LineID[];
  /** 1-indexed from the front of the train. */
  expectedTrainCarIndex: number;
  platformPositioningText: string;
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
