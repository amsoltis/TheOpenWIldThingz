import type { LineID, StationID } from '@streetlevel/shared';

/**
 * The micro-navigation survey layer.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE ADDING RECORDS.
 *
 * None of this data exists in any public feed. GTFS knows that a station has
 * platforms; it does not know which staircase puts you on the right corner,
 * which car door lines up with the exit, or that the passage to the uptown
 * platform is behind you as you come off the escalator. That knowledge only
 * comes from a person standing in the station writing it down.
 *
 * Consequently every record carries a `provenance` field, and the shaper
 * treats the two values very differently:
 *
 *   FIELD_SURVEYED    — someone physically checked this, on this date. The
 *                       shaper will put its landmark text in front of a
 *                       traveller as an instruction.
 *   SAMPLE_UNVERIFIED — structurally plausible placeholder used to exercise
 *                       the pipeline. The shaper will NOT quote its landmark
 *                       text as fact; it falls back to generic instructions
 *                       that stay true regardless ("follow the signs for the
 *                       7 train").
 *
 * The records below are all SAMPLE_UNVERIFIED. Shipping a landmark cue that is
 * wrong is worse than shipping none at all: a tourist who walks to a corner
 * that has no entrance is more lost than one who was told to read the signs.
 * ─────────────────────────────────────────────────────────────────────────
 */
export type Provenance = 'FIELD_SURVEYED' | 'SAMPLE_UNVERIFIED';

export interface EntranceRecord {
  entranceId: string;
  stationId: StationID;
  streetName: string;
  crossStreet: string;
  cornerCode: 'NW' | 'NE' | 'SW' | 'SE' | 'MID';
  entranceType: 'STAIRS' | 'ELEVATOR' | 'ESCALATOR';
  hasOmnyTurnstile: boolean;
  /** What the traveller should physically look for. Only quoted when surveyed. */
  landmarkDescription: string;
  avoidanceNotes?: string;
  latitude: number;
  longitude: number;
  provenance: Provenance;
  /** ISO date the survey was taken. Required for FIELD_SURVEYED records. */
  surveyedOn?: string;
}

export interface PlatformConnectionRecord {
  connectionId: string;
  originStationId: StationID;
  targetLineId: LineID;
  directionBound: 'UPTOWN' | 'DOWNTOWN' | 'BROOKLYN' | 'QUEENS' | 'BRONX';
  walkingPathInstructions: string;
  /** What is written on the signs hanging from the ceiling along this path. */
  ceilingSignMarkers: string[];
  avoidanceTrackNoise?: string;
  provenance: Provenance;
  surveyedOn?: string;
}

export interface ExitCarAlignmentRecord {
  alignmentId: string;
  originStationId: StationID;
  destinationStationId: StationID;
  transitLineId: LineID;
  /** 1-indexed from the front of the train. */
  optimalCarIndex: number;
  platformLandmarkMarker: string;
  exitStairwellIdentifier: string;
  surfacingStreetCorner: string;
  provenance: Provenance;
  surveyedOn?: string;
}

export interface MicroNavDataset {
  entrances: EntranceRecord[];
  platformConnections: PlatformConnectionRecord[];
  exitCarAlignments: ExitCarAlignmentRecord[];
}

/**
 * A deliberately small sample covering a few high-traffic complexes, purely so
 * the pipeline has something to exercise end to end. Station ids are the MTA's
 * own GTFS parent-station ids.
 */
export const MICRO_NAV: MicroNavDataset = {
  entrances: [
    {
      entranceId: 'ENT-127-01',
      stationId: '127', // Times Sq-42 St (1/2/3)
      streetName: '7 Av',
      crossStreet: 'W 42 St',
      cornerCode: 'SE',
      entranceType: 'STAIRS',
      hasOmnyTurnstile: true,
      landmarkDescription: 'Street stair on the block corner beneath the large illuminated advertising screens.',
      avoidanceNotes:
        'This complex has entrances on all four corners feeding different lines. Crossing to a different corner underground means a long passage.',
      latitude: 40.75529,
      longitude: -73.98713,
      provenance: 'SAMPLE_UNVERIFIED',
    },
    {
      entranceId: 'ENT-611-01',
      stationId: '611', // Grand Central-42 St (4/5/6/7/S)
      streetName: 'E 42 St',
      crossStreet: 'Lexington Av',
      cornerCode: 'NW',
      entranceType: 'STAIRS',
      hasOmnyTurnstile: true,
      landmarkDescription: 'Stair down directly beside the terminal building frontage.',
      avoidanceNotes:
        'Entering through the main terminal concourse instead adds a long indoor walk before you reach any turnstile.',
      latitude: 40.75182,
      longitude: -73.97663,
      provenance: 'SAMPLE_UNVERIFIED',
    },
    {
      entranceId: 'ENT-A32-01',
      stationId: 'A32', // 34 St-Penn Station (A/C/E)
      streetName: 'W 34 St',
      crossStreet: '8 Av',
      cornerCode: 'NE',
      entranceType: 'STAIRS',
      hasOmnyTurnstile: true,
      landmarkDescription: 'Stair at the base of the block-long stone building with the colonnade.',
      avoidanceNotes:
        'The 8 Av station and the 7 Av station are different stations two long blocks apart. Confirm which one your train uses before descending.',
      latitude: 40.75217,
      longitude: -73.99338,
      provenance: 'SAMPLE_UNVERIFIED',
    },
    {
      entranceId: 'ENT-R16-01',
      stationId: 'R16', // Times Sq-42 St (N/Q/R/W)
      streetName: 'Broadway',
      crossStreet: 'W 42 St',
      cornerCode: 'NE',
      entranceType: 'STAIRS',
      hasOmnyTurnstile: true,
      landmarkDescription: 'Stair at the foot of the wide red stepped seating area.',
      latitude: 40.75529,
      longitude: -73.98663,
      provenance: 'SAMPLE_UNVERIFIED',
    },
    {
      entranceId: 'ENT-635-01',
      stationId: '635', // 14 St-Union Sq (4/5/6/L/N/Q/R/W)
      streetName: 'E 14 St',
      crossStreet: 'Union Sq East',
      cornerCode: 'NE',
      entranceType: 'STAIRS',
      hasOmnyTurnstile: true,
      landmarkDescription: 'Stair at the park-side edge of the plaza, beside the open market area.',
      avoidanceNotes: 'The south end entrances feed a different mezzanine and require a long walk back underground.',
      latitude: 40.73476,
      longitude: -73.98956,
      provenance: 'SAMPLE_UNVERIFIED',
    },
  ],

  platformConnections: [
    {
      connectionId: 'PC-127-7-QUEENS',
      originStationId: '127',
      targetLineId: '7',
      directionBound: 'QUEENS',
      walkingPathInstructions:
        'From the platform, walk to the far end and take the passage marked for the 7, then ride the long escalator down two levels.',
      ceilingSignMarkers: ['7 Flushing', 'Queens'],
      avoidanceTrackNoise: 'The shuttle to Grand Central leaves from a different level; do not follow the S signs.',
      provenance: 'SAMPLE_UNVERIFIED',
    },
    {
      connectionId: 'PC-611-7-QUEENS',
      originStationId: '611',
      targetLineId: '7',
      directionBound: 'QUEENS',
      walkingPathInstructions:
        'Follow the overhead signs for the 7 down the ramp, then take the escalator to the deepest level.',
      ceilingSignMarkers: ['7 Flushing', 'Queens'],
      provenance: 'SAMPLE_UNVERIFIED',
    },
    {
      connectionId: 'PC-635-L-BROOKLYN',
      originStationId: '635',
      targetLineId: 'L',
      directionBound: 'BROOKLYN',
      walkingPathInstructions:
        'Take the stairs down at the north end of the mezzanine and follow the passage under the street.',
      ceilingSignMarkers: ['L Brooklyn', '8 Av / Canarsie'],
      avoidanceTrackNoise: 'Trains on the level above are the N Q R W; ignore them.',
      provenance: 'SAMPLE_UNVERIFIED',
    },
  ],

  exitCarAlignments: [
    {
      alignmentId: 'EXIT-127-611-S',
      originStationId: '127',
      destinationStationId: '611',
      transitLineId: 'S',
      optimalCarIndex: 1,
      platformLandmarkMarker: 'Board at the very front of the shuttle.',
      exitStairwellIdentifier: 'Front-of-platform stair',
      surfacingStreetCorner: 'Lexington Av at E 42 St',
      provenance: 'SAMPLE_UNVERIFIED',
    },
    {
      alignmentId: 'EXIT-635-127-N',
      originStationId: '635',
      destinationStationId: '127',
      transitLineId: 'N',
      optimalCarIndex: 8,
      platformLandmarkMarker: 'Stand toward the rear half of the platform.',
      exitStairwellIdentifier: 'Rear stair to the 42 St mezzanine',
      surfacingStreetCorner: 'Broadway at W 42 St',
      provenance: 'SAMPLE_UNVERIFIED',
    },
  ],
};

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

export function entrancesForStation(stationId: StationID): EntranceRecord[] {
  return MICRO_NAV.entrances.filter((e) => e.stationId === stationId);
}

export function connectionFor(
  stationId: StationID,
  targetLine: LineID,
): PlatformConnectionRecord | undefined {
  return MICRO_NAV.platformConnections.find(
    (c) => c.originStationId === stationId && c.targetLineId === targetLine,
  );
}

export function exitAlignmentFor(
  originStationId: StationID,
  destinationStationId: StationID,
  line: LineID,
): ExitCarAlignmentRecord | undefined {
  return MICRO_NAV.exitCarAlignments.find(
    (a) =>
      a.originStationId === originStationId &&
      a.destinationStationId === destinationStationId &&
      a.transitLineId === line,
  );
}

/**
 * The gate that keeps unverified placeholder prose out of a traveller's face.
 * Call this before quoting any surveyed string as an instruction.
 */
export function isQuotable(record: { provenance: Provenance }): boolean {
  return record.provenance === 'FIELD_SURVEYED';
}
