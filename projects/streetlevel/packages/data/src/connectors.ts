import type { StationID } from '@streetlevel/shared';

/**
 * Fare-linked services that are not in the subway feed.
 *
 * The subway GTFS covers the subway, and only the subway. That is a statement
 * about one feed's scope, not about what a rider can use.
 *
 * The Roosevelt Island Tramway is the case that makes the distinction matter.
 * It is part of the MTA fare network: the same fare, the same OMNY tap or
 * MetroCard, and the same free transfer to and from the subway. To a traveller
 * it is simply another way across the river on the fare they already paid. It
 * is missing from the subway feed because it is not a subway, not because it is
 * outside the network — and treating a feed's boundary as the product's
 * boundary would be an org chart leaking into an interface.
 *
 * So connectors are routed like any other in-network move, and the fare status
 * is a field rather than an assumption, because the ones that *do* cost extra
 * (the AirTrain, the ferries) must never be silently routed through.
 *
 * These records are hand-authored and clearly marked as such. Every field that
 * could be wrong — coordinates, durations, headways — is approximate and should
 * be treated the way the micro-navigation layer's unverified records are.
 */
export interface Connector {
  connectorId: string;
  name: string;
  /** How the traveller physically crosses. Not a subway line. */
  mode: 'AERIAL_TRAM' | 'FERRY' | 'AIRTRAIN' | 'FUNICULAR';
  /** Nearest subway station at each end, so it joins the routable graph. */
  fromStationId: StationID;
  toStationId: StationID;
  /** Ride time in seconds, excluding waiting. */
  seconds: number;
  /** Typical wait. Aerial trams run far less often than trains. */
  headwaySeconds: number;
  /** True when the ordinary subway fare covers it with no extra payment. */
  includedInSubwayFare: boolean;
  /** Endpoint coordinates, for drawing. */
  fromPoint: { latitude: number; longitude: number };
  toPoint: { latitude: number; longitude: number };
  /**
   * How to get from each paired subway station to the connector's own doors.
   * A connector is joined to the graph at the nearest station, and "nearest"
   * can still be several blocks at street level — so the walk is written down
   * rather than left for the traveller to discover.
   */
  fromApproach: string;
  toApproach: string;
  /**
   * What happens at the fare gate, stated plainly.
   *
   * The single most likely way to lose money here is not knowing the fare
   * already covers it. Tapping again is not paying again, and a tourist has no
   * way to know that from the turnstile.
   */
  fareNote: string;
  /** What the traveller should expect, in the product's voice. */
  note: string;
  provenance: 'HAND_AUTHORED' | 'AGENCY_FEED';
}

export const CONNECTORS: Connector[] = [
  {
    connectorId: 'CONN-RIT',
    name: 'Roosevelt Island Tramway',
    mode: 'AERIAL_TRAM',
    // Lexington Av/59 St is the practical subway end: the Manhattan tram
    // station is a couple of blocks east at 59 St and 2 Av.
    fromStationId: 'R11',
    toStationId: 'B06',
    seconds: 210,
    headwaySeconds: 450,
    includedInSubwayFare: true,
    fromPoint: { latitude: 40.7614, longitude: -73.9640 },
    toPoint: { latitude: 40.7573, longitude: -73.9538 },
    fromApproach:
      'The Tramway station is at 59 St and 2 Av, about two blocks east of the subway. You come up ' +
      'to the street to reach it, and the cabin is visible from the corner.',
    toApproach:
      'The Tramway station on Roosevelt Island is a few minutes from the subway station and is ' +
      'signed from the street. We have not surveyed the walk, so follow the signs rather than ' +
      'guessing at a corner.',
    fareNote:
      'You tap again at the Tramway turnstile with the same OMNY card, phone or MetroCard you used ' +
      'for the subway. Tapping again is not paying again — the transfer is free.',
    note:
      'A cable car over the East River, and part of the subway fare — the same tap, and the ' +
      'transfer is free. It runs every 7 to 15 minutes, and the view is the reason many people ' +
      'ride it rather than taking the F.',
    provenance: 'HAND_AUTHORED',
  },
];

export function connectorsAt(stationId: StationID): Connector[] {
  return CONNECTORS.filter((c) => c.fromStationId === stationId || c.toStationId === stationId);
}

/**
 * The connector joining two stations, in either direction.
 *
 * Matched on endpoints rather than name because that is what a routed leg
 * actually knows, and because a name is a label while the endpoints are the
 * thing the router reasoned about.
 */
export function connectorBetween(from: StationID, to: StationID): Connector | undefined {
  return CONNECTORS.find(
    (c) =>
      (c.fromStationId === from && c.toStationId === to) ||
      (c.fromStationId === to && c.toStationId === from),
  );
}

/**
 * Deliberately absent, and worth writing down so it is a decision rather than
 * an oversight:
 *
 * - **Staten Island Railway** — in the feed, but excluded at import. Different
 *   fare gates and a ferry ride away; a tourist routed onto it by accident is
 *   badly stranded.
 * - **Staten Island Ferry** — free, frequent, and genuinely a tourist
 *   destination. Belongs here eventually.
 * - **JFK AirTrain** — needs a separate fare, so routing someone onto it
 *   without saying so would cost them money at a gate.
 * - **NYC Ferry** — separate fare and a separate operator.
 */
export const KNOWN_ABSENT_CONNECTORS = [
  'Staten Island Railway',
  'Staten Island Ferry',
  'JFK AirTrain',
  'NYC Ferry',
] as const;
