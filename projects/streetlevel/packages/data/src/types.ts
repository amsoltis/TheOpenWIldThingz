import type { LineID, StationID } from '@streetlevel/shared';

import type { Connector } from './connectors.js';
import type { PathwayDataset } from './pathways.js';

export type BoroughCode = 'M' | 'B' | 'Q' | 'X' | 'SI';

export interface StationNode {
  id: StationID;
  /** Stations joined by an in-system passageway share a complexId (Times Sq, etc.). */
  complexId: string;
  name: string;
  borough: BoroughCode;
  lines: LineID[];
  latitude: number;
  longitude: number;
}

/**
 * When a hop is actually scheduled.
 *
 * This is not bookkeeping — it is a correctness requirement. The 4 train stops
 * at 33 St only during late-night local running; the N serves Rector St only
 * when it drops onto the local track overnight. A graph without service periods
 * will cheerfully route a 2pm traveller onto a train that will not stop for
 * them, which is the exact failure this product exists to prevent.
 */
export type ServicePeriod = 'WEEKDAY' | 'WEEKEND' | 'LATE_NIGHT';

/** Number of scheduled trips making a hop in each period. */
export interface ServiceCounts {
  weekday: number;
  weekend: number;
  lateNight: number;
}

/** A directed hop between adjacent stations on one line. */
export interface TrackEdge {
  from: StationID;
  to: StationID;
  line: LineID;
  /** GTFS travel direction. Never shown to a traveller. */
  direction: DirectionCode;
  /** The most common headsign on trains making this hop — what is on the train. */
  headsign: string;
  /** Median scheduled running time across every trip that makes this hop. */
  seconds: number;
  service: ServiceCounts;
  /**
   * Stations this hop passes through without stopping — derived by comparing an
   * express hop against the local line sharing its trunk. This is what feeds
   * the "you should see 28th St fly past" reassurance card.
   */
  passesWithoutStopping: string[];
}

/** A walking connection inside a station complex. */
export interface TransferEdge {
  from: StationID;
  to: StationID;
  seconds: number;
  /** True when both ends are the same station (a cross-platform or stair change). */
  inPlace: boolean;
}

export type DirectionCode = 'N' | 'S';

export interface LinePattern {
  /** Headsigns physically displayed on the front of the train, most common first. */
  headsigns: string[];
  /** The line's dominant stopping pattern in this direction, in order. */
  stations: StationID[];
}

export interface NetworkMeta {
  feedVersion: string;
  feedStartDate: string;
  feedEndDate: string;
  generatedAt: string;
  sourceUrl: string;
  stationCount: number;
  edgeCount: number;
}

export interface SubwayNetwork {
  meta: NetworkMeta;
  stations: Record<StationID, StationNode>;
  edges: TrackEdge[];
  transfers: TransferEdge[];
  patterns: Record<string, Partial<Record<DirectionCode, LinePattern>>>;
  /**
   * GTFS-Pathways indoor navigation, when the feed carries it. Empty against
   * the MTA's current feeds — see `pathways.ts` for what the agency does and
   * does not publish.
   */
  pathways: PathwayDataset;
  /**
   * Fare-linked services the subway feed does not carry. Hand-authored — see
   * `connectors.ts` for what is deliberately absent and why.
   */
  connectors: Connector[];
}
