import { describe, expect, it } from 'vitest';
import { SubwayTheme } from '@streetlevel/shared';

import { nextOccurrence, parseClockTime, resolveTripWindow } from './clock';
import { hapticStepsFor, pulseOffsets, totalHapticDurationMs } from './hapticPlan';
import { legDurationText, orderedCards, primaryLineOf } from './journey';
import { colourWordsFor, joinWithAnd, peripheralReassuranceText } from './lineCopy';
import { markdownToPlainText, parseInlineMarkdown, parseMarkdownBlocks } from './markdown';
import { downloadedTripsReassurance, paywallHeadline, paywallSubline } from './paywallCopy';
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
