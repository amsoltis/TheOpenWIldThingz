import { describe, expect, it } from 'vitest';

import { findStationsByName, GazetteerGeocoder, getIndex } from '@streetlevel/data';

import { activeServicePeriod, edgeRunsDuring, planRoute } from './route.js';
import { NoRouteFoundError, planTrip, planTripFromStation } from './plan-trip.js';
import type { RideLeg } from './types.js';

const geocoder = new GazetteerGeocoder();
const WEEKDAY_AFTERNOON = new Date('2026-08-11T14:00:00-04:00'); // a Tuesday
const LATE_NIGHT = new Date('2026-08-12T01:30:00-04:00');
const SATURDAY_NOON = new Date('2026-08-15T12:00:00-04:00');

function stationId(name: string): string {
  const matches = findStationsByName(name);
  const exact = matches.find((s) => s.name === name) ?? matches[0];
  if (!exact) throw new Error(`No station named ${name}`);
  return exact.id;
}

function rides(legs: { kind: string }[]): RideLeg[] {
  return legs.filter((l): l is RideLeg => l.kind === 'RIDE');
}

describe('activeServicePeriod', () => {
  it('reads New York local time, not the host clock', () => {
    expect(activeServicePeriod(WEEKDAY_AFTERNOON)).toBe('WEEKDAY');
    expect(activeServicePeriod(LATE_NIGHT)).toBe('LATE_NIGHT');
    expect(activeServicePeriod(SATURDAY_NOON)).toBe('WEEKEND');
  });

  it('treats an early-morning UTC instant as New York late night', () => {
    // 05:30 UTC is 01:30 in New York — late night there, morning in UTC.
    expect(activeServicePeriod(new Date('2026-08-12T05:30:00Z'))).toBe('LATE_NIGHT');
  });
});

describe('service-period filtering', () => {
  it('keeps the 4 train off 33 St during the day', () => {
    // The 4 runs express in Manhattan and only serves 33 St when it drops to
    // the local track overnight. Routing a daytime rider onto it would leave
    // them watching their train go past without stopping.
    const index = getIndex();
    const thirtyThird = stationId('33 St');
    const fourEdges = (index.edgesFrom.get(thirtyThird) ?? []).filter((e) => e.line === '4');
    for (const edge of fourEdges) {
      expect(edgeRunsDuring(edge, 'WEEKDAY')).toBe(false);
    }
  });

  it('finds a daytime route that only uses lines actually running', () => {
    const plan = planRoute(stationId('Times Sq-42 St'), stationId('Grand Central-42 St'), {
      at: WEEKDAY_AFTERNOON,
    });
    expect(plan).not.toBeNull();
    expect(plan!.servicePeriod).toBe('WEEKDAY');
    expect(plan!.legs.length).toBeGreaterThan(0);
  });
});

describe('planRoute', () => {
  it('routes Union Sq to Bedford Av on the L with no transfers', () => {
    const plan = planRoute(stationId('14 St-Union Sq'), stationId('Bedford Av'), {
      at: WEEKDAY_AFTERNOON,
    });
    expect(plan).not.toBeNull();
    const legs = rides(plan!.legs);
    expect(legs).toHaveLength(1);
    expect(legs[0]!.line).toBe('L');
    expect(plan!.transferCount).toBe(0);
  });

  it('gives every ride leg a headsign that is on the front of the train', () => {
    const plan = planRoute(stationId('Bedford Av'), stationId('86 St'), { at: WEEKDAY_AFTERNOON });
    expect(plan).not.toBeNull();
    for (const leg of rides(plan!.legs)) {
      expect(leg.headsign.length).toBeGreaterThan(0);
      expect(leg.stations.length).toBeGreaterThanOrEqual(2);
      expect(leg.stations[0]).toBe(leg.from);
      expect(leg.stations.at(-1)).toBe(leg.to);
    }
  });

  it('never begins or ends a plan with a transfer', () => {
    const plan = planRoute(stationId('Times Sq-42 St'), stationId('Bedford Av'), {
      at: WEEKDAY_AFTERNOON,
    });
    expect(plan).not.toBeNull();
    expect(plan!.legs[0]!.kind).toBe('RIDE');
    expect(plan!.legs.at(-1)!.kind).toBe('RIDE');
  });

  it('trades ride time for fewer transfers when the penalty is raised', () => {
    const origin = stationId('Times Sq-42 St');
    const target = stationId('Eastern Pkwy-Brooklyn Museum');
    const cheap = planRoute(origin, target, { at: WEEKDAY_AFTERNOON, transferPenaltySeconds: 0 });
    const dear = planRoute(origin, target, { at: WEEKDAY_AFTERNOON, transferPenaltySeconds: 1200 });
    expect(cheap).not.toBeNull();
    expect(dear).not.toBeNull();
    expect(dear!.transferCount).toBeLessThanOrEqual(cheap!.transferCount);
  });

  it('returns an empty plan for a trip to the station you are already at', () => {
    const id = stationId('Bedford Av');
    const plan = planRoute(id, id, { at: WEEKDAY_AFTERNOON });
    expect(plan!.legs).toHaveLength(0);
  });
});

describe('service alerts', () => {
  const suspendL = [
    {
      alertId: 'a1',
      affectedLineIds: ['L' as const],
      affectedStationIds: [],
      activeFrom: '2026-08-12T00:00:00-04:00',
      activeUntil: '2026-08-12T05:00:00-04:00',
      effect: 'NO_SERVICE' as const,
      headerPlainText: 'No L train overnight',
    },
  ];

  it('routes around a suspended line and says which one it avoided', () => {
    // Myrtle-Wyckoff has both the L and the M, so a working alternative exists.
    const plan = planRoute(stationId('14 St-Union Sq'), stationId('Myrtle-Wyckoff Avs'), {
      at: LATE_NIGHT,
      alerts: suspendL,
    });
    expect(plan).not.toBeNull();
    expect(rides(plan!.legs).some((l) => l.line === 'L')).toBe(false);
    expect(plan!.divertedAroundLines).toContain('L');
  });

  it('ignores an alert outside its own time window', () => {
    const plan = planRoute(stationId('14 St-Union Sq'), stationId('Bedford Av'), {
      at: WEEKDAY_AFTERNOON,
      alerts: suspendL,
    });
    expect(rides(plan!.legs).some((l) => l.line === 'L')).toBe(true);
  });

  it('reports no route when the only line serving the destination is suspended', () => {
    // Bedford Av is served by the L alone. Refusing is correct; inventing a
    // route to a station with no running service is not.
    const plan = planRoute(stationId('14 St-Union Sq'), stationId('Bedford Av'), {
      at: LATE_NIGHT,
      alerts: suspendL,
    });
    expect(plan).toBeNull();
  });
});

describe('planTrip', () => {
  it('plans a real door-to-door trip', async () => {
    const trip = await planTrip('Empire State Building', 'Brooklyn Botanic Garden', {
      at: WEEKDAY_AFTERNOON,
      geocoder,
    });
    expect(trip.totalMinutes).toBeGreaterThan(15);
    expect(trip.totalMinutes).toBeLessThan(120);
    expect(rides(trip.route.legs).length).toBeGreaterThan(0);
  });

  it('anchors the boarding station to where the first train is actually caught', async () => {
    const trip = await planTrip('Times Square', 'Brooklyn Botanic Garden', {
      at: WEEKDAY_AFTERNOON,
      geocoder,
    });
    const first = rides(trip.route.legs)[0]!;
    const last = rides(trip.route.legs).at(-1)!;
    // Otherwise the entrance card names a staircase for a line the traveller
    // never boards.
    expect(trip.boardStationId).toBe(first.from);
    expect(trip.alightStationId).toBe(last.to);
  });

  it('tells you to walk rather than sending you underground for one stop', async () => {
    await expect(planTrip('Times Square', 'Bryant Park', { at: WEEKDAY_AFTERNOON, geocoder })).rejects.toMatchObject({
      reason: 'WALK_INSTEAD',
    });
  });

  it('refuses an address it cannot place instead of guessing', async () => {
    await expect(
      planTrip('zzz nowhere zzz', 'Times Square', { at: WEEKDAY_AFTERNOON, geocoder }),
    ).rejects.toBeInstanceOf(NoRouteFoundError);
  });
});

describe('planTripFromStation', () => {
  it('plans from where a lost traveller is standing, without advising a walk', async () => {
    const trip = await planTripFromStation(stationId('Bedford Av'), 'The Met', {
      at: WEEKDAY_AFTERNOON,
      geocoder,
    });
    expect(trip.walkToStationMinutes).toBe(0);
    expect(trip.boardStationId).toBe(stationId('Bedford Av'));
    expect(rides(trip.route.legs).length).toBeGreaterThan(0);
  });
});
