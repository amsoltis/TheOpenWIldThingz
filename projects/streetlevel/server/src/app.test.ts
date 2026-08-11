import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import type { PaywallExceptionResponse, TransitPacket, UserBillingProfile } from '@streetlevel/shared';

import { buildApp } from './app.js';
import { StaticAlertProvider, parseAlerts } from './alerts.js';
import { InMemoryAccountStore } from './billing.js';

const DEVICE = { 'x-device-id': 'device-abc-123', 'x-device-platform': 'IOS' };

describe('the packet API', () => {
  let app: FastifyInstance;
  let store: InMemoryAccountStore;

  beforeEach(async () => {
    store = new InMemoryAccountStore(3);
    app = await buildApp({ store, config: { freeCredits: 3 } });
  });

  afterEach(async () => {
    await app.close();
  });

  const requestPacket = (headers = DEVICE, body: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: '/v1/packets',
      headers,
      payload: {
        originAddress: 'Times Square',
        destinationAddress: 'Brooklyn Botanic Garden',
        departAt: '2026-08-11T14:00:00-04:00',
        returnAt: '2026-08-11T18:00:00-04:00',
        ...body,
      },
    });

  it('compiles a packet and spends one credit', async () => {
    const res = await requestPacket();
    expect(res.statusCode).toBe(201);
    const body = res.json() as { packet: TransitPacket; billing: UserBillingProfile };
    expect(body.packet.outboundJourney.navigationCards.length).toBeGreaterThan(0);
    expect(body.packet.returnJourney.navigationCards.length).toBeGreaterThan(0);
    expect(body.billing.creditsRemaining).toBe(2);
  });

  it('refuses without a device id rather than serving anonymously', async () => {
    const res = await requestPacket({} as typeof DEVICE);
    expect(res.statusCode).toBe(400);
  });

  it('returns 402 with purchasable SKUs once the free rides are gone', async () => {
    for (let i = 0; i < 3; i++) expect((await requestPacket()).statusCode).toBe(201);

    const res = await requestPacket();
    expect(res.statusCode).toBe(402);
    const paywall = res.json() as PaywallExceptionResponse;
    expect(paywall.errorType).toBe('QUOTA_EXHAUSTED');
    expect(paywall.targetSkus.length).toBeGreaterThan(0);
    expect(paywall.targetSkus[0]!.localizedPriceText).toMatch(/\$/);
    // The conversion copy names where they were actually trying to go.
    expect(paywall.message).toMatch(/Brooklyn Botanic Garden/);
  });

  it('does not charge for a trip it could not build', async () => {
    const before = await store.ensure('device-abc-123', 'IOS');
    const res = await requestPacket(DEVICE, { destinationAddress: 'zzz not a real place zzz' });
    expect(res.statusCode).toBe(422);
    const after = await store.get('device-abc-123');
    expect(after!.creditsRemaining).toBe(before.creditsRemaining);
  });

  it('meters per device, so one traveller cannot spend another traveller credits', async () => {
    for (let i = 0; i < 3; i++) await requestPacket();
    expect((await requestPacket()).statusCode).toBe(402);

    const other = await requestPacket({ ...DEVICE, 'x-device-id': 'device-xyz-999' });
    expect(other.statusCode).toBe(201);
  });

  it('stops metering entirely once the pass is bought', async () => {
    for (let i = 0; i < 3; i++) await requestPacket();
    await app.inject({
      method: 'POST',
      url: '/v1/billing/unlock',
      headers: DEVICE,
      payload: { receipt: 'store-receipt-token' },
    });

    for (let i = 0; i < 4; i++) expect((await requestPacket()).statusCode).toBe(201);
    const profile = await store.get('device-abc-123');
    expect(profile!.isPremiumUnlocked).toBe(true);
  });

  it('says walk rather than charging for a trip not worth taking', async () => {
    const res = await requestPacket(DEVICE, { destinationAddress: 'Bryant Park' });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { error: string }).error).toBe('WALK_INSTEAD');
    const profile = await store.get('device-abc-123');
    expect(profile!.creditsRemaining).toBe(3);
  });

  it('rejects a malformed timestamp', async () => {
    const res = await requestPacket(DEVICE, { departAt: 'tomorrow-ish' });
    expect(res.statusCode).toBe(400);
  });
});

describe('the recovery API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ store: new InMemoryAccountStore(3) });
  });
  afterEach(async () => {
    await app.close();
  });

  const recover = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/v1/recover', headers: DEVICE, payload });

  it('asks for more detail instead of guessing from an ambiguous description', async () => {
    const res = await recover({ surroundingsDescription: '23', intendedDestinationAddress: 'Times Square' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { confidence: number; recoveryCards: unknown[]; clarifyingQuestions: string[] };
    expect(body.confidence).toBeLessThan(0.45);
    expect(body.recoveryCards).toHaveLength(0);
    expect(body.clarifyingQuestions.length).toBeGreaterThan(0);
  });

  it('never charges a lost traveller a credit', async () => {
    const store = new InMemoryAccountStore(3);
    const metered = await buildApp({ store });
    await metered.inject({
      method: 'POST',
      url: '/v1/recover',
      headers: DEVICE,
      payload: { surroundingsDescription: 'the sign says Bedford Av', intendedDestinationAddress: 'The Met' },
    });
    const profile = await store.get('device-abc-123');
    // Showing a paywall to somebody stranded underground is the one thing this
    // product must never do.
    expect(profile?.creditsRemaining ?? 3).toBe(3);
    await metered.close();
  });

  it('requires a description', async () => {
    expect((await recover({ surroundingsDescription: '   ' })).statusCode).toBe(400);
  });
});

describe('health and readiness', () => {
  it('reports the schedule feed it is serving', async () => {
    const app = await buildApp({ store: new InMemoryAccountStore(3) });
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { feedVersion: string; stations: number; proseShaping: string };
    expect(body.stations).toBeGreaterThan(400);
    expect(body.feedVersion.length).toBeGreaterThan(0);
    // With no NIM endpoint configured the deterministic compiler is the whole
    // pipeline, and that is a supported production posture.
    expect(body.proseShaping).toBe('deterministic');
    await app.close();
  });
});

describe('alert ingestion', () => {
  it('keeps well-formed alerts', () => {
    const alerts = parseAlerts([
      {
        alertId: 'a1',
        affectedLineIds: ['L'],
        affectedStationIds: [],
        activeFrom: '2026-08-12T00:00:00-04:00',
        activeUntil: '2026-08-12T05:00:00-04:00',
        effect: 'NO_SERVICE',
        headerPlainText: 'No L overnight',
      },
    ]);
    expect(alerts).toHaveLength(1);
  });

  it('drops alerts that would silently corrupt the graph', () => {
    expect(
      parseAlerts([
        { alertId: 'bad-line', affectedLineIds: ['K'], effect: 'NO_SERVICE', activeFrom: '2026-08-12T00:00:00Z', activeUntil: '2026-08-12T05:00:00Z' },
        { alertId: 'bad-effect', affectedLineIds: ['L'], effect: 'PARTY', activeFrom: '2026-08-12T00:00:00Z', activeUntil: '2026-08-12T05:00:00Z' },
        { alertId: 'bad-date', affectedLineIds: ['L'], effect: 'NO_SERVICE', activeFrom: 'soon', activeUntil: 'later' },
        'not an object',
      ]),
    ).toHaveLength(0);
  });

  it('applies a loaded alert to the routes it compiles', async () => {
    const alerts = new StaticAlertProvider(
      parseAlerts([
        {
          alertId: 'g-slow',
          affectedLineIds: ['G'],
          affectedStationIds: [],
          activeFrom: '2026-08-11T17:00:00-04:00',
          activeUntil: '2026-08-11T23:00:00-04:00',
          effect: 'REDUCED_SERVICE',
          headerPlainText: 'G train every 20 minutes',
        },
      ]),
    );
    const app = await buildApp({ store: new InMemoryAccountStore(3), alerts });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/packets',
      headers: DEVICE,
      payload: {
        originAddress: 'Times Square',
        destinationAddress: 'Brooklyn Botanic Garden',
        departAt: '2026-08-11T14:00:00-04:00',
        returnAt: '2026-08-11T18:00:00-04:00',
      },
    });
    const body = res.json() as { packet: TransitPacket };
    expect(body.packet.isMaintenanceDiverted).toBe(true);
    await app.close();
  });
});
