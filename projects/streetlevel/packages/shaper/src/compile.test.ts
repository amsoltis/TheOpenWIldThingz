import { describe, expect, it, beforeAll } from 'vitest';

import { assertValidPacket, RECOVERY_CONFIDENCE_FLOOR, type TransitPacket } from '@streetlevel/shared';
import { GazetteerGeocoder, findStationsByName } from '@streetlevel/data';

import { compilePacket, detectDivergence, ReturnLegUnavailableError } from './packet.js';
import { containsCompassDirection, dimmedLinesSentence } from './language.js';
import { confidenceFromRanking, extractClues, rankStations, resolveAndRecover } from './recover.js';
import { isSafeRewrite } from './nim.js';

const geocoder = new GazetteerGeocoder();
const NOW = new Date('2026-08-11T13:30:00-04:00');

describe('compilePacket', () => {
  let packet: TransitPacket;

  beforeAll(async () => {
    packet = await compilePacket({
      originAddress: 'Times Square',
      destinationAddress: 'Brooklyn Botanic Garden',
      departAt: '2026-08-11T14:00:00-04:00',
      returnAt: '2026-08-11T18:00:00-04:00',
      geocoder,
      packetId: 'pkt_test',
      now: NOW,
    });
  });

  it('produces a packet that satisfies the wire contract', () => {
    expect(() => assertValidPacket(packet)).not.toThrow();
  });

  it('builds both legs of the round trip', () => {
    expect(packet.outboundJourney.navigationCards.length).toBeGreaterThanOrEqual(4);
    expect(packet.returnJourney.navigationCards.length).toBeGreaterThanOrEqual(4);
  });

  it('opens at the street and ends on the street', () => {
    const cards = packet.outboundJourney.navigationCards;
    expect(cards[0]!.phaseType).toBe('ENTRANCE_APPROACH');
    expect(cards.at(-1)!.phaseType).toBe('EXIT_SURFACING');
  });

  it('never uses a compass direction in traveller-facing prose', () => {
    // The core promise of the product: a tourist cannot use a compass bearing
    // while standing underground.
    for (const leg of [packet.outboundJourney, packet.returnJourney]) {
      for (const card of leg.navigationCards) {
        const prose = [card.primaryInstructionMarkdown, ...card.visualAnchors, card.criticalAvoidanceNotes ?? ''].join(' ');
        expect(containsCompassDirection(prose), `compass direction in ${card.cardId}: ${prose}`).toBe(false);
      }
    }
  });

  it('tells the traveller which train to board on every platform card', () => {
    const platformCards = packet.outboundJourney.navigationCards.filter((c) => c.phaseType === 'PLATFORM_WAIT');
    expect(platformCards.length).toBeGreaterThan(0);
    for (const card of platformCards) {
      expect(card.targetLineFocus).toBeDefined();
      expect(card.targetLineFocus!.activeLineColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(card.targetLineFocus!.platformPositioningText.length).toBeGreaterThan(0);
      // Dimming the line you are waiting for would actively mislead.
      expect(card.targetLineFocus!.coLocatedLinesToDim).not.toContain(card.targetLineFocus!.activeLineId);
    }
  });

  it('names the co-located trains rather than hiding them', () => {
    const platform = packet.outboundJourney.navigationCards.find(
      (c) => c.phaseType === 'PLATFORM_WAIT' && (c.targetLineFocus?.coLocatedLinesToDim.length ?? 0) > 0,
    );
    expect(platform).toBeDefined();
    const anchors = platform!.visualAnchors.join(' ');
    // Every dimmed line must be named. A train the traveller can physically see
    // but the app never mentions reads as the app being broken.
    for (const line of platform!.targetLineFocus!.coLocatedLinesToDim) {
      expect(anchors).toContain(line);
    }
    expect(anchors).toMatch(/stop here too|Let them pass/i);
  });

  it('gives every on-train card a next-station check the rider can verify through the window', () => {
    for (const card of packet.outboundJourney.navigationCards.filter((c) => c.phaseType === 'ON_TRAIN')) {
      expect(card.offlineSensorValidation?.expectedNextStationNodeName).toBeTruthy();
      expect(card.offlineSensorValidation!.expectedTunnelTransitCount).toBeGreaterThan(0);
      expect(card.visualAnchors.join(' ')).toMatch(/wrong way|next stop|first stop/i);
    }
  });

  it('names every stop on the ride, not just how many there are', () => {
    const onTrain = packet.outboundJourney.navigationCards.filter((c) => c.phaseType === 'ON_TRAIN');
    expect(onTrain.length).toBeGreaterThan(0);
    for (const card of onTrain) {
      const ladder = card.stopLadder;
      expect(ladder).toBeDefined();
      // The ladder starts where they board and ends where they get off, so its
      // length must agree with the stop count the card tells them to expect.
      expect(ladder!.stops.length).toBe((card.offlineSensorValidation?.expectedTunnelTransitCount ?? 0) + 1);
      expect(ladder!.alightIndex).toBe(ladder!.stops.length - 1);
      expect(ladder!.stops.every((s) => s.trim().length > 0)).toBe(true);
      // The instruction names the alight station; the ladder must agree with it.
      expect(card.primaryInstructionMarkdown).toContain(ladder!.stops[ladder!.alightIndex]!);
    }
  });

  it('flags express stations that fly past, against the stop they precede', () => {
    // Times Square to Brooklyn on the 3 runs express past 28/23/18 St.
    const withSkips = packet.outboundJourney.navigationCards.find(
      (c) => c.phaseType === 'ON_TRAIN' && c.stopLadder?.passedThrough,
    );
    if (!withSkips) return; // not every routing of this trip is express
    const ladder = withSkips.stopLadder!;
    for (const [index, names] of Object.entries(ladder.passedThrough!)) {
      const i = Number(index);
      expect(i).toBeGreaterThan(0);
      expect(i).toBeLessThan(ladder.stops.length);
      expect(names.length).toBeGreaterThan(0);
    }
  });

  it('expires the packet rather than letting a stale deck be trusted', () => {
    expect(Date.parse(packet.expiresAt)).toBeGreaterThan(Date.parse(packet.compiledAt));
  });

  it('stays small enough to cache on a phone', () => {
    expect(JSON.stringify(packet).length).toBeLessThan(500 * 1024);
  });
});

describe('dimmedLinesSentence', () => {
  it('refuses to use colour when the other trains are the same colour', () => {
    // The 1, 2 and 3 are all red. "Wait for the red train" at Times Square is
    // the single worst instruction this product could give.
    const text = dimmedLinesSentence('3', ['1', '2'])!;
    expect(text).toMatch(/same red as yours/i);
    expect(text).toMatch(/read the number/i);
    expect(text).not.toMatch(/Let them pass/i);
  });

  it('uses colour when colour genuinely separates them', () => {
    const text = dimmedLinesSentence('7', ['A', 'N'])!;
    expect(text).toMatch(/blue and yellow trains/);
    expect(text).toMatch(/Let them pass/i);
  });

  it('says nothing when there is nothing sharing the platform', () => {
    expect(dimmedLinesSentence('L', [])).toBeNull();
  });
});

describe('the divergence engine', () => {
  it('flags an overnight return that is not the outbound reversed', async () => {
    const packet = await compilePacket({
      originAddress: 'Times Square',
      destinationAddress: 'Brooklyn Botanic Garden',
      departAt: '2026-08-11T14:00:00-04:00',
      returnAt: '2026-08-12T01:30:00-04:00',
      geocoder,
      packetId: 'pkt_diverge',
      now: NOW,
    });
    expect(packet.isMaintenanceDiverted).toBe(true);
    // The warning has to land where the traveller meets it, not in a flag.
    expect(packet.returnJourney.navigationCards[0]!.criticalAvoidanceNotes).toMatch(
      /do not assume your way home is your way out reversed/i,
    );
  });

  it('reports a planned service change affecting the return window', async () => {
    const packet = await compilePacket({
      originAddress: 'Times Square',
      destinationAddress: 'Brooklyn Botanic Garden',
      departAt: '2026-08-11T14:00:00-04:00',
      returnAt: '2026-08-11T18:00:00-04:00',
      geocoder,
      packetId: 'pkt_alert',
      now: NOW,
      alerts: [
        {
          alertId: 'x',
          affectedLineIds: ['G'],
          affectedStationIds: [],
          activeFrom: '2026-08-11T17:00:00-04:00',
          activeUntil: '2026-08-11T23:00:00-04:00',
          effect: 'REDUCED_SERVICE',
          headerPlainText: 'G train running every 20 minutes',
        },
      ],
    });
    expect(packet.isMaintenanceDiverted).toBe(true);
  });

  it('walks the traveller to a different line rather than giving up when one is suspended', async () => {
    // Bedford Av is L-only, but Marcy Av is a few minutes away on the J/M/Z.
    // Refusing here would be lazy; the right answer is a different station.
    const packet = await compilePacket({
      originAddress: 'Times Square',
      destinationAddress: 'Williamsburg',
      departAt: '2026-08-11T14:00:00-04:00',
      returnAt: '2026-08-12T01:30:00-04:00',
      geocoder,
      packetId: 'pkt_reroute',
      now: NOW,
      alerts: [
        {
          alertId: 'l-out',
          affectedLineIds: ['L'],
          affectedStationIds: [],
          activeFrom: '2026-08-12T00:00:00-04:00',
          activeUntil: '2026-08-12T05:00:00-04:00',
          effect: 'NO_SERVICE',
          headerPlainText: 'No L train overnight',
        },
      ],
    });
    expect(packet.isMaintenanceDiverted).toBe(true);
    const returnProse = packet.returnJourney.navigationCards
      .map((c) => c.primaryInstructionMarkdown)
      .join(' ');
    expect(returnProse).not.toMatch(/\*\*L\*\*/);
  });

  it('refuses to fabricate a return leg when every line home is suspended', async () => {
    // Coney Island and its neighbours are served only by the D, F, N and Q.
    await expect(
      compilePacket({
        originAddress: 'Times Square',
        destinationAddress: 'Coney Island',
        departAt: '2026-08-11T14:00:00-04:00',
        returnAt: '2026-08-12T01:30:00-04:00',
        geocoder,
        packetId: 'pkt_noreturn',
        now: NOW,
        alerts: [
          {
            alertId: 'south-brooklyn-out',
            affectedLineIds: ['D', 'F', 'N', 'Q'],
            affectedStationIds: [],
            activeFrom: '2026-08-12T00:00:00-04:00',
            activeUntil: '2026-08-12T05:00:00-04:00',
            effect: 'NO_SERVICE',
            headerPlainText: 'No D, F, N or Q service in south Brooklyn overnight',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ReturnLegUnavailableError);
  });

  it('finds nothing to warn about when the return mirrors the outbound', () => {
    const trip = {
      boardStationId: 'A',
      alightStationId: 'B',
      route: { legs: [{ kind: 'RIDE', line: '6' }], transferCount: 0, servicePeriod: 'WEEKDAY' },
    } as never;
    const back = {
      boardStationId: 'B',
      alightStationId: 'A',
      route: { legs: [{ kind: 'RIDE', line: '6' }], transferCount: 0, servicePeriod: 'WEEKDAY' },
    } as never;
    expect(detectDivergence(trip, back, []).diverted).toBe(false);
  });
});

describe('extractClues', () => {
  it('pulls street numbers out of what a traveller types', () => {
    const clues = extractClues('the tiles on the pillars say 23rd and the signs only say uptown');
    expect(clues.numbers).toContain('23');
  });

  it('only claims a line when it is described as one', () => {
    // "6th Avenue" must not be read as the 6 train.
    expect(extractClues('I am on 6 Avenue').lines).toHaveLength(0);
    expect(extractClues('I got on the 6 train by mistake').lines).toContain('6');
  });
});

describe('rankStations', () => {
  it('surfaces the stations matching a described number', () => {
    const ranked = rankStations('the wall tiles say 23 and there is an A train sign');
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.some((c) => c.name.includes('23'))).toBe(true);
  });

  it('is unsure when a number names several different stations', () => {
    // "23 St" is four stations on four lines. Confident here would be dangerous.
    const ranked = rankStations('23');
    expect(confidenceFromRanking(ranked)).toBeLessThan(RECOVERY_CONFIDENCE_FLOOR);
  });
});

describe('resolveAndRecover', () => {
  it('asks for more detail instead of routing from a guess', async () => {
    const result = await resolveAndRecover(
      { surroundingsDescription: '23', intendedDestinationAddress: 'Times Square' },
      { geocoder, at: NOW },
    );
    expect(result.confidence).toBeLessThan(RECOVERY_CONFIDENCE_FLOOR);
    expect(result.recoveryCards).toHaveLength(0);
    expect(result.clarifyingQuestions!.length).toBeGreaterThan(0);
  });

  it('says so plainly when nothing in the description matches', async () => {
    const result = await resolveAndRecover(
      { surroundingsDescription: 'it is dark and there are people' },
      { geocoder, at: NOW },
    );
    expect(result.recoveryCards).toHaveLength(0);
    expect(result.clarifyingQuestions!.length).toBeGreaterThan(0);
  });

  it('builds a recovery deck that starts underground, not at a staircase', async () => {
    const bedford = findStationsByName('Bedford Av')[0]!;
    const result = await resolveAndRecover(
      {
        surroundingsDescription: `the sign says ${bedford.name} and I took the L train`,
        intendedDestinationAddress: 'The Met',
      },
      { geocoder, at: NOW },
    );
    expect(result.confidence).toBeGreaterThanOrEqual(RECOVERY_CONFIDENCE_FLOOR);
    expect(result.recoveryCards.length).toBeGreaterThan(0);
    // Telling someone on a platform to go find a street entrance is the bug.
    expect(result.recoveryCards[0]!.phaseType).not.toBe('ENTRANCE_APPROACH');
  });
});

describe('isSafeRewrite', () => {
  const original = {
    primaryInstructionMarkdown: 'Ride 5 stops and get off at **Bedford Av**.',
    visualAnchors: ['The next stop is Lorimer St.'],
  };

  it('accepts a faithful rewrite', () => {
    expect(
      isSafeRewrite(original, {
        primaryInstructionMarkdown: 'Stay on for 5 stops, then step off at **Bedford Av**.',
        visualAnchors: ['Your next stop will be Lorimer St.'],
      }),
    ).toBe(true);
  });

  it('rejects a rewrite that drops the station name', () => {
    expect(
      isSafeRewrite(original, {
        primaryInstructionMarkdown: 'Ride 5 stops and get off at the next big station.',
        visualAnchors: ['The next stop is Lorimer St.'],
      }),
    ).toBe(false);
  });

  it('rejects a rewrite that changes the stop count', () => {
    expect(
      isSafeRewrite(original, {
        primaryInstructionMarkdown: 'Ride 6 stops and get off at **Bedford Av**.',
        visualAnchors: ['The next stop is Lorimer St.'],
      }),
    ).toBe(false);
  });

  it('rejects a rewrite that smuggles in a compass direction', () => {
    expect(
      isSafeRewrite(original, {
        primaryInstructionMarkdown: 'Ride 5 stops northbound and get off at **Bedford Av**.',
        visualAnchors: ['The next stop is Lorimer St.'],
      }),
    ).toBe(false);
  });

  it('rejects a rewrite that loses an anchor', () => {
    expect(isSafeRewrite(original, { primaryInstructionMarkdown: original.primaryInstructionMarkdown, visualAnchors: [] })).toBe(false);
  });
});

describe('fare-linked connectors on the cards', () => {
  let cards: TransitPacket['outboundJourney']['navigationCards'];

  beforeAll(async () => {
    const packet = await compilePacket({
      originAddress: 'Times Square',
      destinationAddress: 'Roosevelt Island',
      departAt: '2026-08-11T14:00:00-04:00',
      returnAt: '2026-08-11T18:00:00-04:00',
      geocoder,
      packetId: 'pkt_tram',
      now: NOW,
      // Without the 63 St tunnel the tram is the only way across, which is
      // exactly the trip worth compiling.
      alerts: [
        {
          alertId: 'a1',
          affectedLineIds: ['F', 'M'],
          affectedStationIds: [],
          activeFrom: '2026-08-11T00:00:00-04:00',
          activeUntil: '2026-08-12T00:00:00-04:00',
          effect: 'NO_SERVICE',
          headerPlainText: 'No F or M trains',
        },
      ],
    });
    cards = packet.outboundJourney.navigationCards;
  });

  const text = (c: { primaryInstructionMarkdown: string; visualAnchors: string[]; criticalAvoidanceNotes?: string }) =>
    [c.primaryInstructionMarkdown, ...c.visualAnchors, c.criticalAvoidanceNotes ?? ''].join('\n');

  it('names the Tramway rather than describing it as a walk', () => {
    const named = cards.filter((c) => text(c).includes('Roosevelt Island Tramway'));
    expect(named.length).toBeGreaterThan(0);
  });

  it('puts the traveller aboard the Tramway on a card of its own', () => {
    const ride = cards.find(
      (c) => c.phaseType === 'ON_TRAIN' && c.primaryInstructionMarkdown.includes('Roosevelt Island Tramway'),
    );
    expect(ride).toBeDefined();
    expect(ride!.primaryInstructionMarkdown).toMatch(/^Ride the/);
  });

  // The user-facing point of the whole feature: the tram is the same fare.
  it('says the fare is already paid before the traveller reaches the turnstile', () => {
    const boarding = cards.find((c) => text(c).includes('Roosevelt Island Tramway'))!;
    expect(text(boarding)).toMatch(/same (fare|OMNY|tap)/i);
    expect(boarding.criticalAvoidanceNotes).toMatch(/Do not buy a separate ticket/);
  });

  // Counting is the stop detector's whole job, and it has no signal to count
  // here. A promised count it cannot verify is worse than no count at all.
  it('does not hand the stop detector a count it cannot verify', () => {
    const ride = cards.find(
      (c) => c.phaseType === 'ON_TRAIN' && c.primaryInstructionMarkdown.includes('Roosevelt Island Tramway'),
    )!;
    expect(ride.offlineSensorValidation).toBeUndefined();
  });

  it('does not tell somebody arriving by cable car to come up the stairs', () => {
    const exit = cards.at(-1)!;
    expect(exit.phaseType).toBe('EXIT_SURFACING');
    expect(text(exit)).not.toMatch(/stairs/i);
    expect(text(exit)).toContain('Roosevelt Island Tramway');
  });

  it('never claims the river crossing kept you inside one fare-paid complex', () => {
    for (const card of cards) {
      expect(text(card)).not.toMatch(/same station complex/);
    }
  });
});
