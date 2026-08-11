import type {
  ConnectorFocusConfig,
  JourneyLeg,
  LineFocusConfig,
  RouteCard,
  StationID,
  StreetEntranceNode,
} from '@streetlevel/shared';
import { LINE_COLORS, PaperTheme, trunkSiblings } from '@streetlevel/shared';
import {
  BOROUGH_NAMES,
  coLocatedLines,
  connectionFor,
  connectorBetween,
  entrancesForStation,
  exitAlignmentFor,
  getIndex,
  getStation,
  isQuotable,
  type Connector,
  type LatLon,
} from '@streetlevel/data';
import type { RideLeg, RoutePlan, TransferLeg, TripPlan } from '@streetlevel/router';

import {
  DEFAULT_CAR_INDEX,
  carPositionText,
  dimmedLinesSentence,
  directionPhrase,
  minutesText,
  pluralStops,
} from './language.js';

export interface CompileOptions {
  /** Free text shown on the planning screen, e.g. "Today around 2:00 PM". */
  plannedDepartureWindow: string;
  /** Stable prefix so card ids are deterministic and diffable across rebuilds. */
  idPrefix: string;
  /**
   * Set for the recovery flow, where the traveller is already through the
   * turnstiles. Suppresses the street-entrance card, which would otherwise tell
   * somebody standing on a platform to go and find a staircase from the street.
   */
  startsUnderground?: boolean;
}

/**
 * Turns a routed path into the card deck.
 *
 * This compiler is the source of truth for the packet. Every station name, line
 * id, stop count and car position on a card comes from here — from the MTA's
 * own schedule data and the surveyed micro-navigation records. The optional
 * language-model pass downstream may only rewrite prose; it can never author
 * these facts. A model that invents a station name strands somebody.
 */
export function compileJourneyLeg(trip: TripPlan, options: CompileOptions): JourneyLeg {
  const cards: RouteCard[] = [];
  const push = (card: Omit<RouteCard, 'cardId' | 'phaseOrder'>) => {
    cards.push({
      ...card,
      cardId: `${options.idPrefix}-${String(cards.length + 1).padStart(2, '0')}`,
      phaseOrder: cards.length + 1,
    });
  };

  const steps = journeySteps(trip.route);
  const firstStep = steps[0];
  // A journey that opens on a connector never goes underground here, so the
  // ordinary entrance card — green globe, staircase, subway sign — would send
  // somebody down a set of stairs they have no reason to use.
  const entrance =
    firstStep?.kind === 'CONNECTOR'
      ? connectorEntrance(firstStep, options.idPrefix)
      : resolveEntrance(trip.boardStationId, trip.origin.point, options.idPrefix);

  if (!options.startsUnderground) {
    push(
      buildEntranceApproachCard(
        trip,
        entrance,
        firstStep?.kind === 'CONNECTOR' ? firstStep.connector : undefined,
      ),
    );
  }

  steps.forEach((step, index) => {
    const previous = steps[index - 1];
    const isFirst = index === 0 && !options.startsUnderground;
    const isLast = index === steps.length - 1;

    if (step.kind === 'CONNECTOR') {
      // When the connector opens the journey, the entrance card has already
      // walked them to its door with the same words. A second card repeating
      // it would be the deck telling somebody to go somewhere they are already
      // standing.
      if (!isFirst) push(buildConnectorBoardingCard(step, previous));
      push(buildConnectorRideCard(step, isLast, trip));
      return;
    }

    push(buildMezzanineCard(step.leg, previous, isFirst));
    push(buildPlatformWaitCard(trip, step.leg, isLast));
    push(buildOnTrainCard(step.leg, isLast, trip));
  });

  // Exit alignment describes where a specific train's doors leave you. It only
  // applies when the last thing the traveller did was ride that train.
  const finalStep = steps.at(-1);
  push(
    buildExitCard(
      trip,
      finalStep?.kind === 'RIDE' ? finalStep.leg : undefined,
      finalStep?.kind === 'CONNECTOR' ? finalStep.connector : undefined,
    ),
  );

  return {
    originAddress: trip.origin.label,
    destinationAddress: trip.destination.label,
    plannedDepartureWindow: options.plannedDepartureWindow,
    totalEstimatedDurationMinutes: Math.max(1, Math.round(trip.totalMinutes)),
    initialStreetEntrance: entrance,
    navigationCards: cards,
  };
}

/* ------------------------------------------------------------------ *
 * Journey steps
 * ------------------------------------------------------------------ */

type JourneyStep =
  | { kind: 'RIDE'; leg: RideLeg }
  | { kind: 'CONNECTOR'; leg: TransferLeg; connector: Connector };

/**
 * The moves the traveller experiences as *going somewhere*.
 *
 * Plain walking transfers are deliberately absent: a change of platform is
 * already the subject of the mezzanine card that follows it, and giving it a
 * card of its own would tell somebody to walk and then, on the next screen,
 * tell them to walk again.
 *
 * A fare-linked connector is the opposite case. Riding the Roosevelt Island
 * Tramway is a vehicle you board, a door that closes and a river you cross;
 * folding it into a transfer card would describe a cable car as a corridor.
 */
function journeySteps(route: RoutePlan): JourneyStep[] {
  const steps: JourneyStep[] = [];
  for (const leg of route.legs) {
    if (leg.kind === 'RIDE') {
      steps.push({ kind: 'RIDE', leg });
      continue;
    }
    if (!leg.connectorName) continue;
    const connector = connectorBetween(leg.from, leg.to);
    // A named connector with no record behind it should not become a card that
    // asserts a duration and a fare we cannot source.
    if (connector) steps.push({ kind: 'CONNECTOR', leg, connector });
  }
  return steps;
}

/** Where the traveller physically is when a step ends. */
function stepEnd(step: JourneyStep): StationID {
  return step.leg.to;
}

/* ------------------------------------------------------------------ *
 * Street entrance
 * ------------------------------------------------------------------ */

/**
 * Picks the staircase to send the traveller to.
 *
 * When the station has been surveyed we can name a corner and a landmark. When
 * it has not, we say so rather than inventing one: the corner code is filled
 * with the side the traveller will approach from — which is true, and is
 * flagged in the warning text as *not* a surveyed entrance position. A tourist
 * who walks to a confidently-named corner that has no staircase is worse off
 * than one who was told to look for any entrance sign.
 */
export function resolveEntrance(
  stationId: StationID,
  originPoint: LatLon,
  idPrefix: string,
): StreetEntranceNode {
  const station = getStation(stationId);
  if (!station) {
    throw new Error(`Cannot build an entrance for unknown station ${stationId}`);
  }

  const surveyed = entrancesForStation(stationId).filter(isQuotable);
  const chosen = surveyed[0];

  if (chosen) {
    return {
      entranceId: chosen.entranceId,
      associatedStationId: stationId,
      streetIntersectionText: `${chosen.streetName} at ${chosen.crossStreet}`,
      geographicCornerCode: chosen.cornerCode === 'MID' ? 'NE' : chosen.cornerCode,
      visualLandmarkCue: chosen.landmarkDescription,
      avoidanceWarningText: chosen.avoidanceNotes,
      latitude: chosen.latitude,
      longitude: chosen.longitude,
    };
  }

  const approach = approachCorner(originPoint, station);
  const linesText = station.lines.join(', ');
  return {
    entranceId: `${idPrefix}-ENT-${stationId}`,
    associatedStationId: stationId,
    // Deliberately not shaped like an intersection. The client draws a
    // four-corner plan whenever it can parse two street names out of this, and
    // a fabricated crossing would put a confident marker on a corner nobody has
    // surveyed.
    streetIntersectionText: `${station.name} station`,
    geographicCornerCode: approach,
    visualLandmarkCue:
      `Look for a staircase with a green globe or lamp and a sign reading "${station.name}". ` +
      `The sign will list the ${linesText} ${station.lines.length === 1 ? 'train' : 'trains'}.`,
    avoidanceWarningText:
      'We have not surveyed the individual staircases at this station, so any entrance signed for ' +
      `${station.name} will do. Once inside, follow the overhead signs rather than guessing.`,
    latitude: station.latitude,
    longitude: station.longitude,
  };
}

/** Which side of the station the traveller arrives from. Not an entrance position. */
function approachCorner(from: LatLon, station: LatLon): 'NW' | 'NE' | 'SW' | 'SE' {
  const northOf = station.latitude >= from.latitude;
  const eastOf = station.longitude >= from.longitude;
  if (northOf) return eastOf ? 'NE' : 'NW';
  return eastOf ? 'SE' : 'SW';
}

/* ------------------------------------------------------------------ *
 * Cards
 * ------------------------------------------------------------------ */

function buildEntranceApproachCard(
  trip: TripPlan,
  entrance: StreetEntranceNode,
  connector: Connector | undefined,
): Omit<RouteCard, 'cardId' | 'phaseOrder'> {
  const walk = Math.max(1, Math.round(trip.walkToStationMinutes));
  const station = getStation(trip.boardStationId);
  const anchors = [entrance.visualLandmarkCue];
  if (connector) {
    // This card stands in for the boarding card, which is suppressed when the
    // journey opens on a connector — so it has to carry that card's facts.
    anchors.push(connectorFrequencyAnchor(connector));
    if (connector.provenance === 'HAND_AUTHORED') {
      anchors.push(connectorProvenanceAnchor(connector));
    }
  } else if (station) {
    anchors.push(`The station name on the sign reads "${station.name}".`);
  }
  // A caveat about our own data is not a prohibition, and the client renders
  // this field under a "DO NOT" heading. Putting "we have not surveyed the
  // staircases here" there produced an alarm that read as an instruction not to
  // use the entrance — so the caveat travels as an anchor and the alarm is kept
  // for the thing that can actually go wrong.
  if (entrance.avoidanceWarningText) anchors.push(entrance.avoidanceWarningText);

  const where = station
    ? `${entrance.streetIntersectionText} in ${BOROUGH_NAMES[station.borough]}`
    : entrance.streetIntersectionText;

  return {
    phaseType: 'ENTRANCE_APPROACH',
    primaryInstructionMarkdown:
      `Walk ${walk === 1 ? 'about a minute' : `about ${walk} minutes`} from ${trip.origin.label} ` +
      `to ${where}.`,
    conciseInstructionMarkdown: connector
      ? `Walk ${walk} min to the **${connector.name}**.`
      : `Walk ${walk} min to **${station?.name ?? entrance.streetIntersectionText}**.`,
    visualAnchors: anchors,
    // The wrong-staircase warning is about a subway station having two of them.
    // A connector has one door at street level, so the warning would be noise —
    // and the money mistake here is a different one.
    criticalAvoidanceNotes: connector
      ? `Do not buy a separate ticket. The ${connector.name} takes the same fare as the subway.`
      : 'Do not go down the first staircase you see. The wrong stairs can put you on the far side of ' +
        'a station with no way across without leaving and paying again.',
    hapticPatternTrigger: 'LIGHT_TAP',
  };
}

function buildMezzanineCard(
  ride: RideLeg,
  previous: JourneyStep | undefined,
  isFirst: boolean,
): Omit<RouteCard, 'cardId' | 'phaseOrder'> {
  const previousRide = previous?.kind === 'RIDE' ? previous.leg : undefined;
  // The station you get off at and the station you board at can be two
  // different records of one complex — Lexington Av/59 St and 59 St are the
  // same building. Naming the arrival station here keeps this card agreeing
  // with the card before it; two names for one place reads as two places.
  const alightStationId = previous ? stepEnd(previous) : ride.from;
  const alightName = getStation(alightStationId)?.name ?? alightStationId;
  const boardName = getStation(ride.from)?.name ?? ride.from;
  const crossesStations = alightStationId !== ride.from;

  const connection = connectionFor(alightStationId, ride.line) ?? connectionFor(ride.from, ride.line);
  const surveyed = connection && isQuotable(connection);

  const anchors: string[] = [];
  if (surveyed && connection) {
    anchors.push(...connection.ceilingSignMarkers.map((m) => `Overhead sign: "${m}"`));
  } else {
    anchors.push(`Follow the overhead signs marked with the ${ride.line} bullet.`);
    if (ride.headsign) anchors.push(`Signs for your platform will name "${ride.headsign}".`);
  }
  const arrivedByConnector = previous?.kind === 'CONNECTOR' ? previous.connector : undefined;

  // Only claim the one-building, one-fare reassurance for a walk between
  // platforms. Somebody who has just crossed a river has genuinely left, and
  // telling them they never did would make the turnstile a surprise.
  if (crossesStations && !arrivedByConnector) {
    anchors.push(
      `${alightName} and ${boardName} are the same station complex — you stay inside and do not pay again.`,
    );
  }

  const instruction = isFirst
    ? `Tap in at the turnstile, then follow the signs for the **${ride.line}** train.`
    : arrivedByConnector
      ? `Get out at **${alightName}**, leave the ${arrivedByConnector.name} station and follow the ` +
        `signs for the **${ride.line}** train.`
      : crossesStations
        ? `Get off here at **${alightName}** and follow the signs through the passage to the **${ride.line}** train.`
        : `Get off here at **${alightName}** and follow the signs for the **${ride.line}** train.`;

  const walkText = surveyed && connection ? connection.walkingPathInstructions : null;

  return {
    phaseType: 'MEZZANINE_TRANSIT',
    primaryInstructionMarkdown: walkText ? `${instruction}\n\n${walkText}` : instruction,
    conciseInstructionMarkdown: isFirst
      ? `In, then follow the **${ride.line}**.`
      : `Off at **${alightName}**, follow the **${ride.line}**.`,
    visualAnchors: anchors,
    criticalAvoidanceNotes:
      surveyed && connection?.avoidanceTrackNoise
        ? connection.avoidanceTrackNoise
        : previousRide
          ? `You are finished with the ${previousRide.line} train. Ignore it from here.`
          : undefined,
    hapticPatternTrigger: isFirst ? undefined : 'DOUBLE_JOLT',
  };
}

function buildPlatformWaitCard(
  trip: TripPlan,
  ride: RideLeg,
  isFinalRide: boolean,
): Omit<RouteCard, 'cardId' | 'phaseOrder'> {
  const fromStation = getStation(ride.from);
  const toStation = getStation(ride.to);
  const alignment = isFinalRide
    ? exitAlignmentFor(ride.from, ride.to, ride.line)
    : undefined;
  const surveyedAlignment = alignment && isQuotable(alignment) ? alignment : undefined;

  const carIndex = surveyedAlignment?.optimalCarIndex ?? DEFAULT_CAR_INDEX;
  const positioningText = surveyedAlignment
    ? `${surveyedAlignment.platformLandmarkMarker} That puts you by the ${surveyedAlignment.exitStairwellIdentifier} when you arrive.`
    : `Any car works for this trip. ${carPositionText(carIndex)}`;

  // Co-located lines are the ones the traveller will physically watch pull in.
  // Trunk siblings are included even where today's schedule does not show them
  // at this platform, because the traveller will still see those bullets on the
  // signs overhead and needs them accounted for.
  const dimmed = [
    ...new Set([...coLocatedLines(ride.from, ride.line), ...trunkSiblings(ride.line)]),
  ]
    .filter((l) => l !== ride.line)
    .sort();

  const lineFocus: LineFocusConfig = {
    activeLineId: ride.line,
    activeLineColor: LINE_COLORS[ride.line],
    coLocatedLinesToDim: dimmed,
    expectedTrainCarIndex: carIndex,
    platformPositioningText: positioningText,
  };

  const direction = directionPhrase(
    ride.headsign,
    fromStation?.borough ?? 'M',
    toStation?.borough ?? 'M',
  );

  const anchors = [
    `The front of the train reads "${ride.headsign}".`,
    `Platform signs show the ${ride.line} bullet.`,
  ];
  const dimSentence = dimmedLinesSentence(ride.line, dimmed);
  if (dimSentence) anchors.push(dimSentence);

  return {
    phaseType: 'PLATFORM_WAIT',
    primaryInstructionMarkdown: `Wait here for the **${ride.line}** train ${direction}.`,
    // What a local would actually say out loud: the bullet and the front sign.
    conciseInstructionMarkdown: `**${ride.line}** toward **${ride.headsign}**.`,
    targetLineFocus: lineFocus,
    visualAnchors: anchors,
    criticalAvoidanceNotes:
      dimmed.length > 0
        ? `Do not board the first train that arrives unless its front sign reads "${ride.headsign}".`
        : undefined,
    hapticPatternTrigger: 'LIGHT_TAP',
  };
}

function buildOnTrainCard(
  ride: RideLeg,
  isFinalRide: boolean,
  trip: TripPlan,
): Omit<RouteCard, 'cardId' | 'phaseOrder'> {
  const stopCount = ride.stations.length - 1;
  const toStation = getStation(ride.to);
  const nextStopId = ride.stations[1];
  const nextStopName = nextStopId ? (getStation(nextStopId)?.name ?? nextStopId) : '';
  const flyPast = ride.passesWithoutStopping[ride.from] ?? [];

  const anchors: string[] = [];

  // The reassurance beat: tell them what they are about to see, so the first
  // thing that happens after the doors close confirms they were right.
  if (flyPast.length > 0) {
    anchors.push(
      `This is an express train. You will pass ${flyPast.join(', ')} without stopping — that is expected.`,
    );
    anchors.push(`Your first stop is ${nextStopName}.`);
  } else if (nextStopName) {
    anchors.push(`The very next stop is ${nextStopName}. Seeing it means you boarded correctly.`);
  }

  anchors.push(`Ride time is ${minutesText(ride.seconds)}.`);

  const wrongWay = firstStationTheWrongWay(ride);
  const destination = isFinalRide ? trip.destination.label : (toStation?.name ?? ride.to);

  const stops = ride.stations.map((id) => getStation(id)?.name ?? id);
  const passedThrough: Record<string, string[]> = {};
  ride.stations.forEach((id, i) => {
    const flown = ride.passesWithoutStopping[id];
    // Keyed by the stop these are seen before, which is the one after the
    // departure they follow.
    if (flown && flown.length > 0) passedThrough[String(i + 1)] = flown;
  });

  return {
    phaseType: 'ON_TRAIN',
    conciseInstructionMarkdown: `${pluralStops(stopCount)} to **${toStation?.name ?? ride.to}**.`,
    stopLadder: {
      stops,
      alightIndex: stops.length - 1,
      ...(Object.keys(passedThrough).length > 0 ? { passedThrough } : {}),
    },
    primaryInstructionMarkdown:
      `Ride ${pluralStops(stopCount)} and get off at **${toStation?.name ?? ride.to}**.` +
      (isFinalRide ? `\n\nThat is your stop for ${destination}.` : '\n\nYou change trains there.'),
    visualAnchors: anchors,
    // The stop ladder now does the counting, so this space belongs to the one
    // thing that can still go badly wrong: being on the right line in the wrong
    // direction. It is checkable through the window within about two minutes.
    criticalAvoidanceNotes: wrongWay
      ? `If the first station you see is ${wrongWay}, you are going the wrong way. Get off there, ` +
        'cross to the opposite platform, and start this card again.'
      : undefined,
    hapticPatternTrigger: isFinalRide ? 'CONTINUOUS_ALERT' : 'DOUBLE_JOLT',
    offlineSensorValidation: {
      expectedTunnelTransitCount: stopCount,
      expectedNextStationNodeName: nextStopName || (toStation?.name ?? ride.to),
    },
  };
}

/**
 * The station a traveller would reach first if they boarded the same line in
 * the opposite direction. This is the cheapest possible wrong-direction check:
 * one station name, verifiable through the window within a couple of minutes,
 * long before the mistake becomes expensive.
 */
function firstStationTheWrongWay(ride: RideLeg): string | null {
  const index = getIndex();
  for (const edge of index.edgesFrom.get(ride.from) ?? []) {
    if (edge.line !== ride.line) continue;
    if (edge.direction === ride.direction) continue;
    return index.stations[edge.to]?.name ?? null;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Connectors
 * ------------------------------------------------------------------ */

/**
 * The wait, framed as reassurance rather than a countdown.
 *
 * Every anxiety this deck exists to answer — is this the right platform, is
 * this my train, did I miss it — needs a different answer here, because a
 * connector has one vehicle and one destination. Saying so is the whole job.
 */
function connectorFrequencyAnchor(connector: Connector): string {
  const wait = Math.max(1, Math.round(connector.headwaySeconds / 60));
  return (
    `It runs about every ${wait} minutes, so there may be a short wait. There is no countdown to ` +
    'watch and no wrong one to board — only one vehicle runs on this route.'
  );
}

/**
 * Tells the client this card is not about a train.
 *
 * A card with no `targetLineFocus` falls back to the nearest line in the deck,
 * which painted the Tramway card Broadway yellow and put a **W** bullet on it.
 * The colour travels in the packet rather than being looked up, for the same
 * reason every other fact does: the client is offline and cannot ask.
 */
function connectorFocusFor(connector: Connector): ConnectorFocusConfig {
  return {
    connectorName: connector.name,
    connectorColor: PaperTheme.colors.connector,
    connectorTextColor: PaperTheme.colors.connectorInk,
    // What is actually written on the signs, which is rarely the full name.
    signpostedAs: connector.name.includes('Tramway') ? 'Tramway' : connector.name,
  };
}

/** Says out loud that these numbers are ours, not the agency's. */
function connectorProvenanceAnchor(connector: Connector): string {
  return (
    `The ${connector.name} is not in the subway's own schedule data, so these times are ` +
    'approximate. The posted times at the station are the ones to trust.'
  );
}

/**
 * The connector's own station, standing in for a subway entrance.
 *
 * Not a street staircase and deliberately not shaped like one: the corner code
 * is the only fabricable field here, and it is filled from the connector's
 * paired subway station rather than from a survey, so the landmark text does
 * the work instead.
 */
function connectorEntrance(
  step: Extract<JourneyStep, { kind: 'CONNECTOR' }>,
  idPrefix: string,
): StreetEntranceNode {
  const { connector, leg } = step;
  const forward = leg.from === connector.fromStationId;
  const point = forward ? connector.fromPoint : connector.toPoint;
  const approach = forward ? connector.fromApproach : connector.toApproach;
  const nearStation = getStation(leg.from);

  return {
    entranceId: `${idPrefix}-CONN-${connector.connectorId}`,
    associatedStationId: leg.from,
    // Deliberately not shaped like an intersection: the client draws a
    // four-corner plan whenever it can parse two street names out of this.
    streetIntersectionText: `the ${connector.name}`,
    geographicCornerCode: nearStation ? approachCorner(nearStation, point) : 'NE',
    visualLandmarkCue: approach,
    avoidanceWarningText: connector.fareNote,
    latitude: point.latitude,
    longitude: point.longitude,
  };
}

/**
 * Getting to a fare-linked service that is not a train.
 *
 * The subway's whole visual grammar — a bullet, a headsign, an overhead sign —
 * is missing here, so the card cannot lean on any of it. What it can do is name
 * the walk, name the wait, and settle the fare question before the traveller is
 * standing at a turnstile deciding whether they are about to be charged twice.
 */
function buildConnectorBoardingCard(
  step: Extract<JourneyStep, { kind: 'CONNECTOR' }>,
  previous: JourneyStep | undefined,
): Omit<RouteCard, 'cardId' | 'phaseOrder'> {
  const { connector, leg } = step;
  const forward = leg.from === connector.fromStationId;
  const approach = forward ? connector.fromApproach : connector.toApproach;
  const fromName = getStation(leg.from)?.name ?? leg.from;
  const previousRide = previous?.kind === 'RIDE' ? previous.leg : undefined;

  const instruction = previous
    ? `Get off here at **${fromName}** and make your way to the **${connector.name}**.`
    : `Make your way to the **${connector.name}**.`;

  const anchors = [connectorFrequencyAnchor(connector), connector.fareNote];
  if (connector.provenance === 'HAND_AUTHORED') {
    anchors.push(connectorProvenanceAnchor(connector));
  }
  // Not a prohibition, so it stays out of the alarm heading — which has one
  // thing to say here and should not have to share it.
  if (previousRide) anchors.push(`You are finished with the ${previousRide.line} train.`);

  return {
    phaseType: 'MEZZANINE_TRANSIT',
    connectorFocus: connectorFocusFor(connector),
    primaryInstructionMarkdown: `${instruction}\n\n${approach}`,
    conciseInstructionMarkdown: previous
      ? `Off at **${fromName}**, to the **${connector.name}**.`
      : `To the **${connector.name}**.`,
    visualAnchors: anchors,
    // A genuine prohibition, and one that costs money to get wrong: a tourist
    // at an unfamiliar turnstile with no train in sight is exactly the person
    // who goes looking for a ticket window.
    criticalAvoidanceNotes:
      `Do not buy a separate ticket. The ${connector.name} takes the same fare as the subway, and ` +
      'a ticket bought at a machine or a booth would be money spent on a ride you have already ' +
      'paid for.',
    hapticPatternTrigger: previous ? 'DOUBLE_JOLT' : undefined,
  };
}

/**
 * Aboard the connector.
 *
 * Shaped as an ON_TRAIN card because that is what the traveller is doing —
 * sitting in a vehicle waiting for one arrival — but deliberately without
 * `offlineSensorValidation`. The stop detector's whole model is tunnel signal
 * loss and station-to-station timing; a cable car in open air over a river
 * matches none of it, and handing that model a count it cannot verify would
 * teach it to be confidently wrong.
 */
function buildConnectorRideCard(
  step: Extract<JourneyStep, { kind: 'CONNECTOR' }>,
  isLast: boolean,
  trip: TripPlan,
): Omit<RouteCard, 'cardId' | 'phaseOrder'> {
  const { connector, leg } = step;
  const fromName = getStation(leg.from)?.name ?? leg.from;
  const toName = getStation(leg.to)?.name ?? leg.to;

  const anchors = [
    connector.note,
    `The ride is ${minutesText(connector.seconds)} and there is nothing in between — it does not ` +
      'stop, so there are no stops to count.',
    `Everybody aboard is going to ${toName}. There is no wrong direction to worry about.`,
  ];

  return {
    phaseType: 'ON_TRAIN',
    connectorFocus: connectorFocusFor(connector),
    primaryInstructionMarkdown:
      `Ride the **${connector.name}** to **${toName}**.` +
      (isLast
        ? `\n\nThat is your stop for ${trip.destination.label}.`
        : '\n\nYou pick up a train from there.'),
    conciseInstructionMarkdown: `**${connector.name}** to **${toName}**.`,
    stopLadder: { stops: [fromName, toName], alightIndex: 1 },
    visualAnchors: anchors,
    hapticPatternTrigger: isLast ? 'CONTINUOUS_ALERT' : 'DOUBLE_JOLT',
  };
}

function buildExitCard(
  trip: TripPlan,
  finalRide: RideLeg | undefined,
  finalConnector: Connector | undefined,
): Omit<RouteCard, 'cardId' | 'phaseOrder'> {
  const station = getStation(trip.alightStationId);
  const walk = Math.max(1, Math.round(trip.walkFromStationMinutes));
  const alignment = finalRide
    ? exitAlignmentFor(finalRide.from, finalRide.to, finalRide.line)
    : undefined;
  const surveyed = alignment && isQuotable(alignment) ? alignment : undefined;

  // Arriving by connector, there is no platform to leave and usually no stairs
  // to come up. "Check the street name at the top of the stairs" would be an
  // instruction with nothing to act on.
  if (finalConnector) {
    return {
      phaseType: 'EXIT_SURFACING',
      primaryInstructionMarkdown:
        `Get out of the ${finalConnector.name} at **${station?.name ?? trip.alightStationId}**, then ` +
        `walk ${walk === 1 ? 'about a minute' : `about ${walk} minutes`} to ${trip.destination.label}.`,
      conciseInstructionMarkdown: `Out at **${station?.name ?? trip.alightStationId}**, walk ${walk} min.`,
      visualAnchors: [
        'You come out at street level, not up from a platform.',
        'Everybody gets out here — it is the end of the line, so there is no stop to miss.',
      ],
      hapticPatternTrigger: 'CONTINUOUS_ALERT',
    };
  }

  const anchors: string[] = [];
  if (surveyed) {
    anchors.push(`Take the ${surveyed.exitStairwellIdentifier}.`);
    anchors.push(`You will come up at ${surveyed.surfacingStreetCorner}.`);
  } else {
    anchors.push('Follow the signs marked EXIT, then check the street name on the sign at the top of the stairs.');
    anchors.push(
      'We have not surveyed the individual exits at this station, so come up at whichever exit is signed and ' +
        'get your bearings at street level.',
    );
  }

  return {
    phaseType: 'EXIT_SURFACING',
    primaryInstructionMarkdown:
      `Leave the station at **${station?.name ?? trip.alightStationId}**, then walk ` +
      `${walk === 1 ? 'about a minute' : `about ${walk} minutes`} to ${trip.destination.label}.`,
    conciseInstructionMarkdown: `Out at **${station?.name ?? trip.alightStationId}**, walk ${walk} min.`,
    visualAnchors: anchors,
    criticalAvoidanceNotes:
      'Do not keep walking if the street names do not match. Go back down and take the other exit — ' +
      'two exits from one station can be a long block apart.',
    hapticPatternTrigger: 'CONTINUOUS_ALERT',
  };
}

/** Count of stations the plan touches — used for logging and sanity checks. */
export function stationsTouched(route: RoutePlan): number {
  const seen = new Set<StationID>();
  for (const leg of route.legs) {
    if (leg.kind === 'RIDE') leg.stations.forEach((s) => seen.add(s));
    else {
      seen.add(leg.from);
      seen.add(leg.to);
    }
  }
  return seen.size;
}
