import { describe, expect, it } from 'vitest';

import {
  PATHWAY_MODE,
  describePathway,
  isStepFree,
  parseEntrances,
  parseLevels,
  parsePathways,
  pathwaysFrom,
  type PathwayDataset,
} from './pathways.js';

/**
 * Fixtures follow the GTFS-Pathways specification's own field shapes. They are
 * synthetic because no agency feed reachable from this build ships pathways —
 * so these tests pin the importer against the standard, which is the thing that
 * has to be right for real data to drop straight in.
 */
const PATHWAYS_CSV = `pathway_id,from_stop_id,to_stop_id,pathway_mode,is_bidirectional,length,traversal_time,stair_count,signposted_as,reversed_signposted_as
P1,ENT-127-A,127-MEZZ,2,1,18.5,45,-24,Downtown & Brooklyn,Street
P2,127-MEZZ,127-PLAT-S,4,0,,60,,To the 1 2 3 Trains,
P3,127-MEZZ,127-PLAT-N,5,1,,90,,Elevator to Uptown Platform,Elevator to Mezzanine
P4,127-MEZZ,127-FARE,6,0,,10,,,
P5,127-PLAT-S,ENT-127-B,7,0,,20,,Exit Only,
BAD,,,9,1,,,,,`;

const LEVELS_CSV = `level_id,level_index,level_name
127-STREET,0,Street
127-MEZZ,-1,Mezzanine
127-PLAT-N,-2,Uptown Platform`;

const STOPS_CSV = `stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station,wheelchair_boarding
127,Times Sq-42 St,40.75529,-73.98750,1,,
127N,Times Sq-42 St,40.75529,-73.98750,,127,
ENT-127-A,7 Av at W 42 St (SE corner),40.75510,-73.98713,2,127,2
ENT-127-B,Broadway at W 42 St (NE corner),40.75560,-73.98663,2,127,1
ENT-BAD,No parent,40.75,-73.98,2,,`;

describe('parsePathways', () => {
  const pathways = parsePathways(PATHWAYS_CSV);

  it('reads every well-formed pathway and drops the malformed one', () => {
    expect(pathways).toHaveLength(5);
    expect(pathways.map((p) => p.pathwayId)).not.toContain('BAD');
  });

  it('keeps the sign text, which is the whole point', () => {
    const stairs = pathways.find((p) => p.pathwayId === 'P1')!;
    expect(stairs.signpostedAs).toBe('Downtown & Brooklyn');
    expect(stairs.reversedSignpostedAs).toBe('Street');
  });

  it('reads a signed stair count', () => {
    expect(pathways.find((p) => p.pathwayId === 'P1')!.stairCount).toBe(-24);
  });

  it('distinguishes one-way from bidirectional', () => {
    expect(pathways.find((p) => p.pathwayId === 'P1')!.isBidirectional).toBe(true);
    expect(pathways.find((p) => p.pathwayId === 'P2')!.isBidirectional).toBe(false);
  });

  it('leaves absent optional fields undefined rather than guessing zero', () => {
    const escalator = pathways.find((p) => p.pathwayId === 'P2')!;
    expect(escalator.stairCount).toBeUndefined();
    expect(escalator.length).toBeUndefined();
  });
});

describe('parseLevels', () => {
  it('reads levels with their index and name', () => {
    const levels = parseLevels(LEVELS_CSV);
    expect(levels).toHaveLength(3);
    expect(levels.find((l) => l.levelId === '127-MEZZ')).toEqual({
      levelId: '127-MEZZ',
      levelIndex: -1,
      levelName: 'Mezzanine',
    });
  });
});

describe('parseEntrances', () => {
  const entrances = parseEntrances(STOPS_CSV);

  it('takes only location_type 2 rows', () => {
    expect(entrances.map((e) => e.stopId)).toEqual(['ENT-127-A', 'ENT-127-B']);
  });

  it('drops an entrance with no parent station, which cannot be routed to', () => {
    expect(entrances.find((e) => e.stopId === 'ENT-BAD')).toBeUndefined();
  });

  it('carries step-free status when the feed states it', () => {
    expect(entrances.find((e) => e.stopId === 'ENT-127-B')!.wheelchairBoarding).toBe(1);
    expect(entrances.find((e) => e.stopId === 'ENT-127-A')!.wheelchairBoarding).toBe(2);
  });
});

describe('describePathway', () => {
  const pathways = parsePathways(PATHWAYS_CSV);
  const levels = parseLevels(LEVELS_CSV);
  const byId = (id: string) => pathways.find((p) => p.pathwayId === id)!;

  it('leads with the sign text, because that is what is above their head', () => {
    const described = describePathway(byId('P1'));
    expect(described.anchors[0]).toBe('Follow the sign that reads "Downtown & Brooklyn".');
  });

  it('sends them down a descending staircase and up when reversed', () => {
    expect(describePathway(byId('P1')).instruction).toBe('Take the stairs down.');
    expect(describePathway(byId('P1'), { reversed: true }).instruction).toBe('Take the stairs up.');
  });

  it('uses the reversed sign text when walking the other way', () => {
    const back = describePathway(byId('P1'), { reversed: true });
    expect(back.anchors[0]).toBe('Follow the sign that reads "Street".');
  });

  it('counts the steps', () => {
    expect(describePathway(byId('P1')).anchors).toContain('24 steps.');
  });

  it('names the level an elevator is going to', () => {
    const lift = describePathway(byId('P3'), { levels });
    expect(lift.instruction).toBe('Take the elevator.');
    expect(lift.anchors.join(' ')).toMatch(/Uptown Platform/);
  });

  it('warns that an exit gate is one-way, which costs a second fare to undo', () => {
    const gate = describePathway(byId('P5'));
    expect(gate.instruction).toBe('Go through the exit gate.');
    expect(gate.warning).toMatch(/cannot come back without paying again/i);
  });

  it('mentions a long passage but stays quiet about a short one', () => {
    expect(describePathway(byId('P3')).anchors.join(' ')).toMatch(/about 2 minutes/);
    expect(describePathway(byId('P4')).anchors.join(' ')).not.toMatch(/minute/);
  });

  it('turns a fare gate into the action it actually is', () => {
    expect(describePathway(byId('P4')).instruction).toBe('Tap in at the turnstile.');
  });
});

describe('pathwaysFrom', () => {
  const dataset: PathwayDataset = {
    pathways: parsePathways(PATHWAYS_CSV),
    levels: parseLevels(LEVELS_CSV),
    entrances: parseEntrances(STOPS_CSV),
  };

  it('finds pathways leaving a node, including the way back out', () => {
    const fromMezz = pathwaysFrom(dataset, '127-MEZZ');
    // P1 is the bidirectional staircase up to the street, so it leaves the
    // mezzanine too — just reversed. A traveller standing here can go back up.
    expect(fromMezz.map((p) => p.pathway.pathwayId).sort()).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(fromMezz.find((p) => p.pathway.pathwayId === 'P1')!.reversed).toBe(true);
    expect(fromMezz.find((p) => p.pathway.pathwayId === 'P2')!.reversed).toBe(false);
  });

  it('walks a bidirectional pathway backwards but never a one-way one', () => {
    const back = pathwaysFrom(dataset, '127-PLAT-N');
    expect(back).toHaveLength(1);
    expect(back[0]!.reversed).toBe(true);

    // P2 is a one-way escalator; you cannot ride it back up.
    expect(pathwaysFrom(dataset, '127-PLAT-S').some((p) => p.pathway.pathwayId === 'P2')).toBe(false);
  });
});

describe('isStepFree', () => {
  it('says no when any leg of the station has stairs', () => {
    const dataset: PathwayDataset = {
      pathways: parsePathways(PATHWAYS_CSV),
      levels: [],
      entrances: [],
    };
    expect(isStepFree(dataset, '127')).toBe(false);
  });

  it('refuses to claim step-free when it simply has no data', () => {
    // Silence is not accessibility. Telling a wheelchair user a station works
    // because nobody recorded the staircase is the worst error available here.
    expect(isStepFree({ pathways: [], levels: [], entrances: [] }, '127')).toBe(false);
  });

  it('says yes only when every recorded pathway avoids steps', () => {
    const stepFree = parsePathways(
      `pathway_id,from_stop_id,to_stop_id,pathway_mode,is_bidirectional
X1,127-A,127-B,5,1
X2,127-B,127-C,1,1`,
    );
    expect(isStepFree({ pathways: stepFree, levels: [], entrances: [] }, '127')).toBe(true);
  });
});
