import { describe, expect, it } from 'vitest';
import { SubwayTheme } from '@streetlevel/shared';

import {
  boldPhrases,
  isPeripheralAnchor,
  isSignAnchor,
  linesServedFrom,
  mentionsStreetGlobe,
  overheadSignLegends,
  stationNameFrom,
  stripStationSuffix,
} from './cardFacts';
import { nextOccurrence, parseClockTime, resolveTripWindow } from './clock';
import { hapticStepsFor, pulseOffsets, totalHapticDurationMs } from './hapticPlan';
import {
  cardLines,
  journeySpine,
  legDurationText,
  orderedCards,
  primaryLineOf,
  segmentWeight,
} from './journey';
import {
  colourWordsFor,
  joinWithAnd,
  peripheralReassuranceText,
  targetLineReassuranceText,
} from './lineCopy';
import { markdownToPlainText, parseInlineMarkdown, parseMarkdownBlocks } from './markdown';
import {
  downloadedTripsReassurance,
  paywallHeadline,
  paywallSubline,
  serverMessageWorthShowing,
  splitTierDescription,
} from './paywallCopy';
import { TRAIN_CAR_COUNT, carSlots, carZone, carZoneText, clampCarIndex } from './platformGeometry';
import { storeProductUrl } from './storeLinks';
import { cornerDescription, cornerQuadrant, splitIntersection } from './streetGeometry';
import type { JourneyLeg, RouteCard } from '@streetlevel/shared';

describe('markdown', () => {
  it('reads the emphasis that carries the instruction', () => {
    expect(parseInlineMarkdown('Take the **left** staircase')).toEqual([
      { text: 'Take the ', bold: false, italic: false },
      { text: 'left', bold: true, italic: false },
      { text: ' staircase', bold: false, italic: false },
    ]);
  });

  it('handles italics and escapes', () => {
    expect(parseInlineMarkdown('_do not_ cross')).toEqual([
      { text: 'do not', bold: false, italic: true },
      { text: ' cross', bold: false, italic: false },
    ]);
    expect(parseInlineMarkdown('5\\*5 platform')).toEqual([
      { text: '5*5 platform', bold: false, italic: false },
    ]);
  });

  it('keeps unmatched delimiters from eating the sentence', () => {
    const segments = parseInlineMarkdown('Exit at 42nd * then walk');
    expect(segments.map((s) => s.text).join('')).toBe('Exit at 42nd  then walk');
  });

  it('splits blocks and bullets', () => {
    const blocks = parseMarkdownBlocks('Go down the stairs\n\n- Turn left\n- Then right');
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'bullet', 'bullet']);
    expect(blocks[1]?.segments[0]?.text).toBe('Turn left');
  });

  it('flattens to plain text for screen readers', () => {
    expect(markdownToPlainText('Take the **left** staircase\n- Not the right one')).toBe(
      'Take the left staircase Not the right one',
    );
  });
});

describe('peripheral dimming copy', () => {
  it('names the colours the traveller will physically see', () => {
    expect(colourWordsFor(['1', '2', 'A'])).toEqual(['red', 'blue']);
    expect(peripheralReassuranceText(['1', '2'])).toBe(
      'You will see red trains pulling in here. They are dimmed because they are irrelevant to you. Let them pass.',
    );
    expect(peripheralReassuranceText(['1', 'A', 'N'])).toContain('red, blue and yellow trains');
  });

  it('says nothing when there is nothing to dim', () => {
    expect(peripheralReassuranceText([])).toBe('');
  });

  it('stops leaning on colour when the trains sharing the platform are the same colour', () => {
    // Times Square: the 1, 2 and 3 are all red, so "wait for the red train" is
    // the worst possible instruction. The number is the only real difference.
    const text = peripheralReassuranceText(['1', '2'], '3');
    expect(text).toMatch(/same colour as yours/i);
    expect(text).toMatch(/number on the front/i);
    expect(text).not.toMatch(/red trains pulling in/i);
  });

  it('keeps the colour cue when the colours actually differ', () => {
    expect(peripheralReassuranceText(['A', 'N'], '7')).toMatch(/blue and yellow trains/);
  });

  it('tells you which number is yours when colour cannot separate them', () => {
    expect(targetLineReassuranceText('3', ['1', '2'])).toMatch(/Check the number, not the colour/i);
    expect(targetLineReassuranceText('7', ['A'])).toBe('Your train is the purple 7. Board only that one.');
  });

  it('joins lists the way a person would say them', () => {
    expect(joinWithAnd([])).toBe('');
    expect(joinWithAnd(['red'])).toBe('red');
    expect(joinWithAnd(['red', 'blue'])).toBe('red and blue');
    expect(joinWithAnd(['red', 'blue', 'green'])).toBe('red, blue and green');
  });
});

describe('platform geometry', () => {
  it('clamps a car index onto the drawn train', () => {
    expect(clampCarIndex(0)).toBe(1);
    expect(clampCarIndex(1)).toBe(1);
    expect(clampCarIndex(11)).toBe(TRAIN_CAR_COUNT);
    expect(clampCarIndex(Number.NaN)).toBe(1);
  });

  it('describes where on the train that is', () => {
    expect(carZone(1)).toBe('FRONT');
    expect(carZone(5)).toBe('MIDDLE');
    expect(carZone(10)).toBe('BACK');
    expect(carZoneText(10)).toContain('back');
  });

  it('draws a fixed-length train', () => {
    expect(carSlots()).toHaveLength(TRAIN_CAR_COUNT);
    expect(carSlots()[0]).toBe(1);
  });
});

describe('street geometry', () => {
  it('splits the intersection prose the shaper produces', () => {
    expect(splitIntersection('7 Av at W 42 St')).toEqual({ primaryStreet: '7 Av', crossStreet: 'W 42 St' });
    expect(splitIntersection('Broadway & W 42 St')).toEqual({
      primaryStreet: 'Broadway',
      crossStreet: 'W 42 St',
    });
    expect(splitIntersection('E 42 St/Lexington Av')).toEqual({
      primaryStreet: 'E 42 St',
      crossStreet: 'Lexington Av',
    });
  });

  it('never invents a second street name it cannot find', () => {
    expect(splitIntersection('Union Sq')).toEqual({ primaryStreet: 'Union Sq', crossStreet: '' });
    expect(cornerDescription('NW', 'Union Sq')).toBe('The north-west corner of Union Sq.');
  });

  it('maps corner codes onto the diagram quadrants', () => {
    expect(cornerQuadrant('NW')).toEqual({ isNorth: true, isWest: true });
    expect(cornerQuadrant('SE')).toEqual({ isNorth: false, isWest: false });
    expect(cornerDescription('SE', '7 Av at W 42 St')).toBe(
      'The south-east corner, where 7 Av crosses W 42 St.',
    );
  });
});

describe('haptic plan', () => {
  it('converts vibration patterns into discrete pulse offsets', () => {
    expect(pulseOffsets(SubwayTheme.hapticSequences.STATION_APPROACH_PATTERN)).toEqual([0, 150]);
    expect(pulseOffsets(SubwayTheme.hapticSequences.CRITICAL_DESTINATION_ALERT)).toEqual([0, 750, 1500]);
    expect(pulseOffsets([])).toEqual([]);
  });

  it('escalates with the packet trigger, not the interaction', () => {
    expect(hapticStepsFor('LIGHT_TAP')).toEqual([{ offsetMs: 0, kind: 'IMPACT_LIGHT' }]);
    expect(hapticStepsFor('DOUBLE_JOLT')).toHaveLength(2);
    const critical = hapticStepsFor('CONTINUOUS_ALERT');
    expect(critical).toHaveLength(3);
    expect(critical[0]?.kind).toBe('NOTIFY_ERROR');
    expect(totalHapticDurationMs(critical)).toBe(1500);
  });

  it('always fires something on a card change', () => {
    expect(hapticStepsFor(undefined)).toEqual([{ offsetMs: 0, kind: 'SELECTION' }]);
  });
});

describe('clock', () => {
  it('accepts the shapes a tourist actually types', () => {
    expect(parseClockTime('9:30')).toEqual({ hours: 9, minutes: 30 });
    expect(parseClockTime('0930')).toEqual({ hours: 9, minutes: 30 });
    expect(parseClockTime('9')).toEqual({ hours: 9, minutes: 0 });
    expect(parseClockTime('9.30pm')).toEqual({ hours: 21, minutes: 30 });
    expect(parseClockTime('12am')).toEqual({ hours: 0, minutes: 0 });
    expect(parseClockTime('21:30')).toEqual({ hours: 21, minutes: 30 });
  });

  it('rejects times that are not times', () => {
    expect(parseClockTime('')).toBeNull();
    expect(parseClockTime('25:00')).toBeNull();
    expect(parseClockTime('10:75')).toBeNull();
    expect(parseClockTime('soon')).toBeNull();
  });

  it('rolls a past time forward to the next occurrence', () => {
    const now = new Date('2026-08-11T18:00:00.000Z');
    const morning = nextOccurrence({ hours: now.getHours() - 2, minutes: 0 }, now);
    expect(morning.getTime()).toBeGreaterThan(now.getTime());
  });

  it('never resolves the return leg before the outbound one', () => {
    const window = resolveTripWindow('18:00', '02:00', new Date('2026-08-11T09:00:00.000Z'));
    expect(window).not.toBeNull();
    expect(new Date(window?.returnAt ?? 0).getTime()).toBeGreaterThan(
      new Date(window?.departAt ?? 0).getTime(),
    );
  });

  it('refuses to build a window from a half-filled form', () => {
    expect(resolveTripWindow('09:30', '')).toBeNull();
    expect(resolveTripWindow('', '18:00')).toBeNull();
  });
});

describe('journey helpers', () => {
  const cards: RouteCard[] = [
    {
      cardId: 'c3',
      phaseOrder: 3,
      phaseType: 'PLATFORM_WAIT',
      primaryInstructionMarkdown: 'Wait here',
      visualAnchors: [],
      targetLineFocus: {
        activeLineId: '7',
        activeLineColor: '#9A38A1',
        coLocatedLinesToDim: [],
        expectedTrainCarIndex: 3,
        platformPositioningText: 'Stand by the second pillar.',
      },
    },
    {
      cardId: 'c1',
      phaseOrder: 1,
      phaseType: 'ENTRANCE_APPROACH',
      primaryInstructionMarkdown: 'Go down',
      visualAnchors: [],
    },
    {
      cardId: 'c2',
      phaseOrder: 2,
      phaseType: 'MEZZANINE_TRANSIT',
      primaryInstructionMarkdown: 'Turn left',
      visualAnchors: [],
    },
  ];

  const leg: JourneyLeg = {
    originAddress: 'A',
    destinationAddress: 'B',
    plannedDepartureWindow: '2026-08-11T13:00:00.000Z',
    totalEstimatedDurationMinutes: 95,
    initialStreetEntrance: {
      entranceId: 'E1',
      associatedStationId: '127',
      streetIntersectionText: '7 Av at W 42 St',
      geographicCornerCode: 'SE',
      visualLandmarkCue: 'Big screens.',
      latitude: 40.7553,
      longitude: -73.9871,
    },
    navigationCards: cards,
  };

  it('walks the deck in phase order regardless of array order', () => {
    expect(orderedCards(leg).map((c) => c.cardId)).toEqual(['c1', 'c2', 'c3']);
    expect(orderedCards(null)).toEqual([]);
  });

  it('takes the accent colour from the first line the leg names', () => {
    expect(primaryLineOf(leg)).toBe('7');
    expect(primaryLineOf(null)).toBeNull();
  });

  it('says durations the way a person would', () => {
    expect(legDurationText(leg)).toBe('about 1 h 35 min');
    expect(legDurationText({ ...leg, totalEstimatedDurationMinutes: 24 })).toBe('about 24 minutes');
    expect(legDurationText({ ...leg, totalEstimatedDurationMinutes: 60 })).toBe('about an hour');
  });
});

describe('card facts', () => {
  const entranceAnchors = [
    'Look for a staircase with a green globe or lamp and a sign reading "Times Sq-42 St". The sign will list the 1, 2, 3 trains.',
    'The station name on the sign reads "Times Sq-42 St".',
  ];

  it('reads the lines the station sign lists', () => {
    expect(linesServedFrom(entranceAnchors)).toEqual(['1', '2', '3']);
    expect(linesServedFrom(['The sign will list the 7 train.'])).toEqual(['7']);
  });

  it('prefers the name as it is physically printed', () => {
    expect(stationNameFrom(entranceAnchors)).toBe('Times Sq-42 St');
    expect(stripStationSuffix('Eastern Pkwy-Brooklyn Museum station')).toBe(
      'Eastern Pkwy-Brooklyn Museum',
    );
  });

  it('takes the emphasised phrases as the structured facts', () => {
    expect(boldPhrases('Ride 14 stops and get off at **Eastern Pkwy**.')).toEqual(['Eastern Pkwy']);
    expect(boldPhrases('No emphasis at all')).toEqual([]);
  });

  it('lifts the ceiling sign legends off the anchors', () => {
    expect(overheadSignLegends(['Signs for your platform will name "New Lots Av".'])).toEqual([
      'New Lots Av',
    ]);
    expect(overheadSignLegends(['Overhead sign: "Downtown & Brooklyn"'])).toEqual([
      'Downtown & Brooklyn',
    ]);
    expect(isSignAnchor('Signs for your platform will name "8 Av".')).toBe(true);
    // The bullet instruction is advice, not a legend printed on the plate.
    expect(isSignAnchor('Follow the overhead signs marked with the 3 bullet.')).toBe(false);
  });

  it('spots the sentences a drawn hero already says', () => {
    expect(
      isPeripheralAnchor(
        'You will also see red trains (1, 2) stopping here. They are dimmed on your screen because they are not yours.',
      ),
    ).toBe(true);
    expect(isPeripheralAnchor('Platform signs show the 3 bullet.')).toBe(false);
    expect(mentionsStreetGlobe(entranceAnchors[0] ?? '')).toBe(true);
    expect(mentionsStreetGlobe('Walk past the bank.')).toBe(false);
  });

  it('refuses to guess when the sentence is not the one it knows', () => {
    expect(linesServedFrom(['Some other sentence entirely.'])).toEqual([]);
    expect(stationNameFrom(['Some other sentence entirely.'])).toBeNull();
    expect(overheadSignLegends(['Some other sentence entirely.'])).toEqual([]);
  });
});

describe('journey spine', () => {
  const deck = (phases: [RouteCard['phaseType'], string | null][]): RouteCard[] =>
    phases.map(([phaseType, line], index) => ({
      cardId: `c${index}`,
      phaseOrder: index + 1,
      phaseType,
      primaryInstructionMarkdown: line ? `Take the **${line}** train.` : 'Walk.',
      visualAnchors: [],
      ...(line && phaseType === 'PLATFORM_WAIT'
        ? {
            targetLineFocus: {
              activeLineId: line as '4',
              activeLineColor: '#009952',
              coLocatedLinesToDim: [],
              expectedTrainCarIndex: 5,
              platformPositioningText: '',
            },
          }
        : {}),
    }));

  it('hands the mezzanine to the train it leads to and the ride to the one behind it', () => {
    const cards = deck([
      ['ENTRANCE_APPROACH', null],
      ['MEZZANINE_TRANSIT', null],
      ['PLATFORM_WAIT', '4'],
      ['ON_TRAIN', null],
      ['EXIT_SURFACING', null],
    ]);
    expect(cardLines(cards)).toEqual([null, '4', '4', '4', null]);
  });

  it('breaks the ribbon into walk, ride and walk', () => {
    const cards = deck([
      ['ENTRANCE_APPROACH', null],
      ['MEZZANINE_TRANSIT', null],
      ['PLATFORM_WAIT', '4'],
      ['ON_TRAIN', null],
      ['EXIT_SURFACING', null],
    ]);
    expect(journeySpine(cards).map((s) => [s.kind, s.line, s.from, s.to])).toEqual([
      ['walk', null, 0, 0],
      ['ride', '4', 1, 3],
      ['walk', null, 4, 4],
    ]);
  });

  it('puts a boundary at every transfer', () => {
    const cards = deck([
      ['PLATFORM_WAIT', 'L'],
      ['ON_TRAIN', null],
      ['MEZZANINE_TRANSIT', null],
      ['PLATFORM_WAIT', '4'],
      ['ON_TRAIN', null],
    ]);
    expect(journeySpine(cards).map((s) => s.line)).toEqual(['L', '4']);
  });

  it('weights a segment by the ride, inside limits that keep a walk visible', () => {
    expect(segmentWeight({ kind: 'walk', line: null, from: 0, to: 0, stopCount: 0 })).toBe(3);
    expect(segmentWeight({ kind: 'ride', line: '4', from: 1, to: 2, stopCount: 1 })).toBe(5);
    expect(segmentWeight({ kind: 'ride', line: '4', from: 1, to: 2, stopCount: 14 })).toBe(14);
    expect(segmentWeight({ kind: 'ride', line: '4', from: 1, to: 2, stopCount: 40 })).toBe(18);
  });

  it('survives a deck with no train in it at all', () => {
    const cards = deck([['ENTRANCE_APPROACH', null]]);
    expect(journeySpine(cards)).toHaveLength(1);
    expect(journeySpine([])).toEqual([]);
  });
});

describe('paywall copy', () => {
  it('names the destination the traveller was two taps from', () => {
    expect(paywallHeadline(3)).toBe("You've used your 3 free navigation keys.");
    expect(paywallHeadline(1)).toBe("You've used your free navigation key.");
    expect(paywallSubline('the Morgan Library')).toContain('walkthrough to the Morgan Library');
  });

  it('degrades to something honest with no destination', () => {
    expect(paywallSubline(null)).toContain('your next stop');
    expect(paywallSubline('   ')).toContain('your next stop');
  });

  it('promises downloaded trips stay readable', () => {
    expect(downloadedTripsReassurance(0)).toContain('stays readable');
    expect(downloadedTripsReassurance(1)).toContain('1 trip');
    expect(downloadedTripsReassurance(2)).toContain('2 trips');
    expect(downloadedTripsReassurance(2)).toContain('forever');
  });

  it('splits a store tier into a product and its promise', () => {
    expect(
      splitTierDescription('City Explorer Pass — unlimited offline trip packets, one payment.'),
    ).toEqual({ name: 'City Explorer Pass', detail: 'unlimited offline trip packets, one payment' });
    expect(splitTierDescription('Lifetime unlock')).toEqual({
      name: 'Lifetime unlock',
      detail: null,
    });
    expect(splitTierDescription('  ')).toEqual({ name: 'Lifetime access', detail: null });
  });

  it('drops a server message that only repeats the copy already on screen', () => {
    const headline = paywallHeadline(3);
    const subline = paywallSubline('the Morgan Library');
    expect(serverMessageWorthShowing(`${headline} ${subline}`, headline, subline)).toBeNull();
    expect(serverMessageWorthShowing('   ', headline, subline)).toBeNull();
    expect(serverMessageWorthShowing('Payments are down for maintenance.', headline, subline)).toBe(
      'Payments are down for maintenance.',
    );
  });
});

describe('store links', () => {
  it('targets the right store for the platform', () => {
    expect(storeProductUrl('lifetime', 'app.streetlevel.client', 'android')).toBe(
      'market://details?id=app.streetlevel.client&sku=lifetime',
    );
    expect(storeProductUrl('lifetime', 'app.streetlevel.client', 'ios')).toContain('itms-apps://');
  });

  it('survives a missing application id', () => {
    expect(storeProductUrl('lifetime', null, 'android')).toContain('id=lifetime');
  });
});
