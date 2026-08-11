import { describe, expect, it } from 'vitest';

import {
  ApiError,
  PacketValidationError,
  PaywallError,
  isPaywallError,
  parsePaywallException,
  travellerFacingMessage,
} from './errors';

describe('parsePaywallException', () => {
  it('passes a well-formed 402 body through unchanged', () => {
    const parsed = parsePaywallException({
      statusCode: 402,
      errorType: 'QUOTA_EXHAUSTED',
      message: 'You have used your 3 free navigation keys.',
      targetSkus: [
        { platformSkuString: 'app.streetlevel.lifetime', localizedPriceText: '$4.99', tierDescription: 'Lifetime' },
      ],
    });
    expect(parsed.message).toBe('You have used your 3 free navigation keys.');
    expect(parsed.targetSkus).toHaveLength(1);
    expect(parsed.targetSkus[0]?.platformSkuString).toBe('app.streetlevel.lifetime');
  });

  it('still produces a usable paywall from a malformed body', () => {
    const parsed = parsePaywallException(null);
    expect(parsed.statusCode).toBe(402);
    expect(parsed.errorType).toBe('QUOTA_EXHAUSTED');
    expect(parsed.message.length).toBeGreaterThan(0);
    expect(parsed.targetSkus).toEqual([]);
  });

  it('drops SKUs that cannot be shown as a purchase option', () => {
    const parsed = parsePaywallException({
      message: '',
      targetSkus: [
        { platformSkuString: 'ok', localizedPriceText: '$1.99' },
        { platformSkuString: '', localizedPriceText: '$2.99', tierDescription: 'Broken' },
        { platformSkuString: 'no-price', tierDescription: 'Broken' },
        'nonsense',
      ],
    });
    expect(parsed.targetSkus).toHaveLength(1);
    expect(parsed.targetSkus[0]).toEqual({
      platformSkuString: 'ok',
      localizedPriceText: '$1.99',
      tierDescription: '',
    });
  });
});

describe('isPaywallError', () => {
  it('distinguishes a 402 from every other failure', () => {
    const paywall = new PaywallError(parsePaywallException({ message: 'Out of keys.' }));
    expect(isPaywallError(paywall)).toBe(true);
    expect(isPaywallError(new ApiError(500, 'boom'))).toBe(false);
    expect(isPaywallError(new Error('boom'))).toBe(false);
    expect(isPaywallError('boom')).toBe(false);
  });

  it('carries the parsed response and a readable message', () => {
    const paywall = new PaywallError(parsePaywallException({ message: 'Out of keys.' }));
    expect(paywall.message).toBe('Out of keys.');
    expect(paywall.response.errorType).toBe('QUOTA_EXHAUSTED');
  });
});

describe('travellerFacingMessage', () => {
  it('hides validator detail behind a plain sentence', () => {
    const message = travellerFacingMessage(
      new PacketValidationError(['packet.outboundJourney.navigationCards: expected an array']),
    );
    expect(message).not.toContain('navigationCards');
    expect(message).toContain('did not make sense');
  });

  it('passes through a service message unchanged', () => {
    expect(travellerFacingMessage(new ApiError(503, 'The routing service is restarting.'))).toBe(
      'The routing service is restarting.',
    );
  });

  it('has something to say about a value that is not an error at all', () => {
    expect(travellerFacingMessage(undefined).length).toBeGreaterThan(0);
  });
});
