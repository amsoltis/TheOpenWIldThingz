import type {
  JourneyLeg,
  LineFocusConfig,
  RouteCard,
  StationID,
  StreetEntranceNode,
} from '@streetlevel/shared';
import { LINE_COLORS, trunkSiblings } from '@streetlevel/shared';
import {
  BOROUGH_NAMES,
  coLocatedLines,
  connectionFor,
  entrancesForStation,
  exitAlignmentFor,
  getIndex,
  getStation,
  isQuotable,
  type LatLon,
} from '@streetlevel/data';
import type { RideLeg, RoutePlan, TripPlan } from '@streetlevel/router';

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

  const entrance = resolveEntrance(trip.boardStationId, trip.origin.point, options.idPrefix);
  const rides = trip.route.legs.filter((l): l is RideLeg => l.kind === 'RIDE');

  if (!options.startsUnderground) {
    push(buildEntranceApproachCard(trip, entrance));
  }

  rides.forEach((ride, index) => {
    const previousRide = index > 0 ? rides[index - 1] : undefined;
    push(buildMezzanineCard(ride, previousRide, index === 0 && !options.startsUnderground));
    push(buildPlatformWaitCard(trip, ride, index === rides.length - 1));
    push(buildOnTrainCard(ride, index === rides.length - 1, trip));
  });

  push(buildExitCard(trip, rides.at(-1)));

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
): Omit<RouteCard, 'cardId' | 'phaseOrder'> {
  const walk = Math.max(1, Math.round(trip.walkToStationMinutes));
  const station = getStation(trip.boardStationId);
  const anchors = [entrance.visualLandmarkCue];
  if (station) {
    anchors.push(`The station name on the sign reads "${station.name}".`);
  }
  const where = station
    ? `${entrance.streetIntersectionText} in ${BOROUGH_NAMES[station.borough]}`
    : entrance.streetIntersectionText;

  return {
    phaseType: 'ENTRANCE_APPROACH',
    primaryInstructionMarkdown:
      `Walk ${walk === 1 ? 'about a minute' : `about ${walk} minutes`} from ${trip.origin.label} ` +
      `to ${where}.`,
    visualAnchors: anchors,
    criticalAvoidanceNotes:
      entrance.avoidanceWarningText ??
      'Do not go down the first staircase you see. Walking down the wrong stairs can put you on the ' +
        'far side of a station with no way across without leaving and paying again.',
    hapticPatternTrigger: 'LIGHT_TAP',
  };
}

function buildMezzanineCard(
  ride: RideLeg,
  previousRide: RideLeg | undefined,
  isFirst: boolean,
): Omit<RouteCard, 'cardId' | 'phaseOrder'> {
  // The station you get off at and the station you board at can be two
  // different records of one complex — Lexington Av/59 St and 59 St are the
  // same building. Naming the arrival station here keeps this card agreeing
  // with the card before it; two names for one place reads as two places.
  const alightStationId = previousRide?.to ?? ride.from;
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
  if (crossesStations) {
    anchors.push(
      `${alightName} and ${boardName} are the same station complex — you stay inside and do not pay again.`,
    );
  }

  const instruction = isFirst
    ? `Tap in at the turnstile, then follow the signs for the **${ride.line}** train.`
    : crossesStations
      ? `Get off here at **${alightName}** and follow the signs through the passage to the **${ride.line}** train.`
      : `Get off here at **${alightName}** and follow the signs for the **${ride.line}** train.`;

  const walkText = surveyed && connection ? connection.walkingPathInstructions : null;

  return {
    phaseType: 'MEZZANINE_TRANSIT',
    primaryInstructionMarkdown: walkText ? `${instruction}\n\n${walkText}` : instruction,
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

  const wrongWay = firstStationTheWrongWay(ride);
  if (wrongWay) {
    anchors.push(
      `If the first station you see is ${wrongWay} instead, you are on a train going the other way. ` +
        'Get off at that station, cross to the opposite platform, and start this card again.',
    );
  }

  anchors.push(`Ride time is ${minutesText(ride.seconds)}.`);

  const destination = isFinalRide ? trip.destination.label : (toStation?.name ?? ride.to);

  return {
    phaseType: 'ON_TRAIN',
    primaryInstructionMarkdown:
      `Ride ${pluralStops(stopCount)} and get off at **${toStation?.name ?? ride.to}**.` +
      (isFinalRide ? `\n\nThat is your stop for ${destination}.` : '\n\nYou change trains there.'),
    visualAnchors: anchors,
    criticalAvoidanceNotes: `Count the stops. ${toStation?.name ?? ride.to} is stop number ${stopCount}.`,
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

function buildExitCard(
  trip: TripPlan,
  finalRide: RideLeg | undefined,
): Omit<RouteCard, 'cardId' | 'phaseOrder'> {
  const station = getStation(trip.alightStationId);
  const walk = Math.max(1, Math.round(trip.walkFromStationMinutes));
  const alignment = finalRide
    ? exitAlignmentFor(finalRide.from, finalRide.to, finalRide.line)
    : undefined;
  const surveyed = alignment && isQuotable(alignment) ? alignment : undefined;

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
    visualAnchors: anchors,
    criticalAvoidanceNotes:
      'If you come up and nothing matches, go back down and try the other exit rather than walking on. ' +
      'Two exits from one station can be a long block apart.',
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
