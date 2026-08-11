import type { LineID, ServiceAlert, StationID } from '@streetlevel/shared';
import type { ServicePeriod } from '@streetlevel/data';

export interface RideLeg {
  kind: 'RIDE';
  line: LineID;
  from: StationID;
  to: StationID;
  /** Every station the train stops at on this leg, origin and destination included. */
  stations: StationID[];
  seconds: number;
  /** GTFS travel direction. Never shown to a traveller — it becomes a headsign. */
  direction: 'N' | 'S';
  /** What is physically displayed on the front of the train, e.g. "Woodlawn". */
  headsign: string;
  /**
   * Stations this leg passes without stopping, in order, keyed by the stop it
   * departs from. Drives the reassurance card.
   */
  passesWithoutStopping: Record<StationID, string[]>;
}

export interface TransferLeg {
  kind: 'TRANSFER';
  from: StationID;
  to: StationID;
  seconds: number;
  /** False when the change is a walk between two stations of one complex. */
  inPlace: boolean;
  /**
   * Set when the change is a ride on a fare-linked service rather than a walk —
   * the Roosevelt Island Tramway, for instance. Without it a card would tell
   * somebody to walk across the East River.
   */
  connectorName?: string;
}

export type RouteLeg = RideLeg | TransferLeg;

export interface RoutePlan {
  originStationId: StationID;
  destinationStationId: StationID;
  legs: RouteLeg[];
  /** In-system time: riding plus transferring. Excludes street walking. */
  totalSeconds: number;
  transferCount: number;
  /** Lines that were unusable for this plan because of an alert. */
  divertedAroundLines: LineID[];
  /** The timetable this plan was built against. */
  servicePeriod: ServicePeriod;
}

export interface RoutingOptions {
  /**
   * The moment of travel. Alerts are evaluated against this, which is what
   * makes a return leg planned for 1am able to differ from the outbound.
   */
  at: Date;
  alerts?: ServiceAlert[];
  /**
   * Seconds of penalty added to every line change, on top of the real walking
   * time. This is not a fudge factor: for an anxious first-time rider a change
   * of trains costs far more than its clock time, so the router is tuned to
   * trade several minutes of riding for one fewer transfer.
   */
  transferPenaltySeconds?: number;
  /** Assumed platform wait. A flat value; the client never shows a countdown. */
  boardingWaitSeconds?: number;
  maxTransfers?: number;
}

export const DEFAULT_TRANSFER_PENALTY_SECONDS = 300;
export const DEFAULT_BOARDING_WAIT_SECONDS = 240;

export interface DivertedContext {
  blockedLines: Set<LineID>;
  blockedStations: Set<StationID>;
  alerts: ServiceAlert[];
}
