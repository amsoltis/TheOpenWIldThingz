import { describe, expect, it } from 'vitest';

import type { RouteCard, TransitPacket } from './contract.js';
import { validateRouteCard, validateTransitPacket, assertValidPacket } from './validate.js';

function platformCard(overrides: Partial<RouteCard> = {}): RouteCard {
  return {
    cardId: 'c1',
    phaseOrder: 1,
    phaseType: 'PLATFORM_WAIT',
    primaryInstructionMarkdown: 'Wait for the **3** train.',
    visualAnchors: ['The front of the train reads "New Lots Av".'],
    targetLineFocus: {
      activeLineId: '3',
      activeLineColor: '#D82233',
      coLocatedLinesToDim: ['1', '2'],
      expectedTrainCarIndex: 5,
      platformPositioningText: 'Stand around the middle of the platform.',
    },
    ...overrides,
  };
}

describe('validateRouteCard', () => {
  it('accepts a well-formed platform card', () => {
    expect(validateRouteCard(platformCard()).ok).toBe(true);
  });

  it('rejects a platform card with no line focus, because the traveller would not know which train to board', () => {
    const card = platformCard();
    delete card.targetLineFocus;
    const result = validateRouteCard(card);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/PLATFORM_WAIT/);
  });

  it('rejects dimming the line the traveller is waiting for', () => {
    const card = platformCard();
    card.targetLineFocus!.coLocatedLinesToDim = ['1', '3'];
    const result = validateRouteCard(card);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/must not contain the active line/);
  });

  it('rejects a car index that would send someone off the end of the platform', () => {
    const card = platformCard();
    card.targetLineFocus!.expectedTrainCarIndex = 14;
    expect(validateRouteCard(card).ok).toBe(false);
  });

  it('rejects an unknown line id', () => {
    const card = platformCard();
    // A model hallucinating a plausible-looking line is exactly what this catches.
    (card.targetLineFocus as { activeLineId: string }).activeLineId = 'K';
    expect(validateRouteCard(card).ok).toBe(false);
  });

  it('rejects a non-hex line colour', () => {
    const card = platformCard();
    card.targetLineFocus!.activeLineColor = 'red';
    expect(validateRouteCard(card).ok).toBe(false);
  });
});

function onTrainCard(overrides: Partial<RouteCard> = {}): RouteCard {
  return {
    cardId: 'c9',
    phaseOrder: 1,
    phaseType: 'ON_TRAIN',
    primaryInstructionMarkdown: 'Ride 2 stops and get off at **Wall St**.',
    visualAnchors: ['The very next stop is Fulton St.'],
    stopLadder: { stops: ['Park Place', 'Fulton St', 'Wall St'], alightIndex: 2 },
    ...overrides,
  };
}

describe('stop ladders', () => {
  it('accepts a well-formed ladder', () => {
    expect(validateRouteCard(onTrainCard()).ok).toBe(true);
  });

  it('rejects an on-train card with no ladder, because counting stops is the whole task', () => {
    const card = onTrainCard();
    delete card.stopLadder;
    const result = validateRouteCard(card);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/stopLadder/);
  });

  it('rejects an alight index past the end of the ladder', () => {
    // The UI would highlight nothing, and the rider would have no stop flagged.
    const result = validateRouteCard(onTrainCard({ stopLadder: { stops: ['A', 'B'], alightIndex: 5 } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/outside the 2 stops/);
  });

  it('rejects alighting at the station you boarded at', () => {
    const result = validateRouteCard(onTrainCard({ stopLadder: { stops: ['A', 'B'], alightIndex: 0 } }));
    expect(result.ok).toBe(false);
  });

  it('rejects a one-stop ladder, which cannot describe a ride', () => {
    const result = validateRouteCard(onTrainCard({ stopLadder: { stops: ['A'], alightIndex: 0 } }));
    expect(result.ok).toBe(false);
  });
});

function minimalPacket(): TransitPacket {
  const leg = {
    originAddress: 'A',
    destinationAddress: 'B',
    plannedDepartureWindow: 'now',
    totalEstimatedDurationMinutes: 20,
    initialStreetEntrance: {
      entranceId: 'e1',
      associatedStationId: '127',
      streetIntersectionText: '7 Av at W 42 St',
      geographicCornerCode: 'SE' as const,
      visualLandmarkCue: 'Stair beside the screens.',
      latitude: 40.7553,
      longitude: -73.9871,
    },
    navigationCards: [platformCard()],
  };
  return {
    packetId: 'pkt_1',
    compiledAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    isMaintenanceDiverted: false,
    outboundJourney: leg,
    returnJourney: { ...leg, navigationCards: [platformCard({ cardId: 'c2' })] },
  };
}

describe('validateTransitPacket', () => {
  it('accepts a well-formed packet', () => {
    expect(validateTransitPacket(minimalPacket()).ok).toBe(true);
  });

  it('rejects coordinates outside the service area', () => {
    const packet = minimalPacket();
    // London. A packet like this would pan the offline map into the sea.
    packet.outboundJourney.initialStreetEntrance.latitude = 51.5;
    packet.outboundJourney.initialStreetEntrance.longitude = -0.12;
    const result = validateTransitPacket(packet);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/outside the NYC service area/);
  });

  it('rejects a journey with no cards', () => {
    const packet = minimalPacket();
    packet.outboundJourney.navigationCards = [];
    expect(validateTransitPacket(packet).ok).toBe(false);
  });

  it('rejects gaps in phaseOrder, which would strand a linear deck mid-swipe', () => {
    const packet = minimalPacket();
    packet.outboundJourney.navigationCards = [
      platformCard({ cardId: 'a', phaseOrder: 1 }),
      platformCard({ cardId: 'b', phaseOrder: 3 }),
    ];
    const result = validateTransitPacket(packet);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/phaseOrder/);
  });

  it('rejects a missing return leg — the round trip is the product', () => {
    const packet = minimalPacket() as Partial<TransitPacket>;
    delete packet.returnJourney;
    expect(validateTransitPacket(packet).ok).toBe(false);
  });

  it('assertValidPacket throws with every problem listed', () => {
    expect(() => assertValidPacket({ packetId: '' })).toThrow(/Invalid TransitPacket/);
  });
});
