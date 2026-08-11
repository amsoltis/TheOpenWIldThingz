import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';

import type {
  PacketRequest,
  PaywallExceptionResponse,
  RecoveryRequest,
} from '@streetlevel/shared';
import { assertValidPacket } from '@streetlevel/shared';
import { ChainGeocoder, GazetteerGeocoder, loadNetwork, type Geocoder } from '@streetlevel/data';
import { NoRouteFoundError } from '@streetlevel/router';
import {
  compilePacket,
  NimClient,
  nimConfigFromEnv,
  resolveAndRecover,
  ReturnLegUnavailableError,
} from '@streetlevel/shaper';

import type { AlertProvider } from './alerts.js';
import { StaticAlertProvider } from './alerts.js';
import { InMemoryAccountStore, type AccountStore, type DevicePlatform } from './billing.js';
import { loadConfig, type ServerConfig } from './config.js';

export interface AppDependencies {
  config?: Partial<ServerConfig>;
  store?: AccountStore;
  alerts?: AlertProvider;
  geocoder?: Geocoder;
  nim?: NimClient;
}

const DEVICE_HEADER = 'x-device-id';
const PLATFORM_HEADER = 'x-device-platform';

function readDevice(request: FastifyRequest): { deviceId: string; platform: DevicePlatform } | null {
  const raw = request.headers[DEVICE_HEADER];
  const deviceId = Array.isArray(raw) ? raw[0] : raw;
  if (!deviceId || deviceId.trim().length < 4 || deviceId.length > 255) return null;

  const platformRaw = request.headers[PLATFORM_HEADER];
  const platform = (Array.isArray(platformRaw) ? platformRaw[0] : platformRaw)?.toUpperCase();
  return {
    deviceId: deviceId.trim(),
    platform: platform === 'ANDROID' ? 'ANDROID' : 'IOS',
  };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export async function buildApp(deps: AppDependencies = {}): Promise<FastifyInstance> {
  const config = { ...loadConfig(), ...deps.config };
  const store = deps.store ?? new InMemoryAccountStore(config.freeCredits);
  const alerts = deps.alerts ?? new StaticAlertProvider([]);
  const geocoder = deps.geocoder ?? new ChainGeocoder([new GazetteerGeocoder()]);
  const nim = deps.nim ?? new NimClient(nimConfigFromEnv());

  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });

  app.decorate('streetlevel', { config, store, alerts, geocoder, nim });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    try {
      // The station graph is the one dependency the service cannot serve without.
      const network = loadNetwork();
      return {
        status: 'ready',
        feedVersion: network.meta.feedVersion,
        feedValidUntil: network.meta.feedEndDate,
        stations: network.meta.stationCount,
        alertsLoaded: alerts.current().length,
        proseShaping: nim.enabled ? 'nim' : 'deterministic',
      };
    } catch (err) {
      return reply.code(503).send({
        status: 'unavailable',
        reason: err instanceof Error ? err.message : 'station graph unavailable',
      });
    }
  });

  app.get('/v1/account', async (request, reply) => {
    const device = readDevice(request);
    if (!device) return reply.code(400).send({ error: 'MISSING_DEVICE_ID', message: `${DEVICE_HEADER} header is required.` });
    return store.ensure(device.deviceId, device.platform);
  });

  app.post('/v1/packets', async (request, reply) => {
    const device = readDevice(request);
    if (!device) {
      return reply.code(400).send({ error: 'MISSING_DEVICE_ID', message: `${DEVICE_HEADER} header is required.` });
    }

    const body = (request.body ?? {}) as Partial<PacketRequest>;
    if (!isNonEmptyString(body.originAddress) || !isNonEmptyString(body.destinationAddress)) {
      return reply.code(400).send({
        error: 'INVALID_REQUEST',
        message: 'originAddress and destinationAddress are required.',
      });
    }

    const departAt = isNonEmptyString(body.departAt) ? body.departAt : new Date().toISOString();
    // Default the return to the same evening: the round trip is the product, so
    // a request without one still gets a way home rather than half a packet.
    const returnAt = isNonEmptyString(body.returnAt)
      ? body.returnAt
      : new Date(Date.parse(departAt) + 6 * 60 * 60 * 1000).toISOString();

    if (Number.isNaN(Date.parse(departAt)) || Number.isNaN(Date.parse(returnAt))) {
      return reply.code(400).send({ error: 'INVALID_REQUEST', message: 'departAt and returnAt must be ISO-8601 timestamps.' });
    }

    // Charged before any compute is spent, per the metering design. Refunded
    // below if the work then fails — a traveller must never lose a credit to
    // our error.
    const consumption = await store.consumeCredit(device.deviceId, device.platform);
    if (!consumption.ok) {
      const paywall: PaywallExceptionResponse = {
        statusCode: 402,
        errorType: 'QUOTA_EXHAUSTED',
        message:
          `You've used your ${config.freeCredits} free navigation keys. Unlock lifetime access to the ` +
          `Plain-English NYC Subway Engine to instantly open your custom, offline walkthrough to ` +
          `${body.destinationAddress}.`,
        targetSkus: config.skus,
      };
      return reply.code(402).send(paywall);
    }

    try {
      const packet = await compilePacket({
        originAddress: body.originAddress,
        destinationAddress: body.destinationAddress,
        departAt,
        returnAt,
        alerts: alerts.current(),
        geocoder,
      });

      // Prose polish is best-effort and must never fail the request; the
      // deterministic packet is already complete and correct without it.
      const shaped = await nim.polishPacket(packet);

      // Last line of defence before anything reaches a phone that may be
      // underground and unable to ask for a correction.
      assertValidPacket(shaped);

      return reply.code(201).send({ packet: shaped, billing: consumption.profile });
    } catch (err) {
      await store.refundCredit(device.deviceId);

      if (err instanceof ReturnLegUnavailableError) {
        return reply.code(409).send({
          error: 'NO_RETURN_ROUTE',
          message: err.message,
          outboundSummary: err.outboundSummary,
        });
      }
      if (err instanceof NoRouteFoundError) {
        const status = err.reason === 'WALK_INSTEAD' ? 200 : 422;
        return reply.code(status).send({
          error: err.reason,
          message: err.message,
          billing: await store.get(device.deviceId),
        });
      }
      request.log.error(err);
      return reply.code(500).send({ error: 'COMPILE_FAILED', message: 'Could not build this trip.' });
    }
  });

  app.post('/v1/recover', async (request, reply) => {
    const device = readDevice(request);
    if (!device) {
      return reply.code(400).send({ error: 'MISSING_DEVICE_ID', message: `${DEVICE_HEADER} header is required.` });
    }

    const body = (request.body ?? {}) as Partial<RecoveryRequest>;
    if (!isNonEmptyString(body.surroundingsDescription)) {
      return reply.code(400).send({
        error: 'INVALID_REQUEST',
        message: 'Tell us what you can see around you.',
      });
    }

    // Deliberately not metered. Someone who is lost underground is the worst
    // possible person to show a paywall to, and the cost of resolving a
    // location is trivial next to compiling a packet.
    const result = await resolveAndRecover(
      {
        surroundingsDescription: body.surroundingsDescription.slice(0, 2000),
        activePacketId: body.activePacketId,
        intendedDestinationAddress: body.intendedDestinationAddress,
      },
      { geocoder, nim, at: new Date() },
    );
    return reply.code(200).send(result);
  });

  /** Grants the pass. A real deployment verifies the store receipt here first. */
  app.post('/v1/billing/unlock', async (request, reply) => {
    const device = readDevice(request);
    if (!device) return reply.code(400).send({ error: 'MISSING_DEVICE_ID', message: `${DEVICE_HEADER} header is required.` });

    const body = (request.body ?? {}) as { receipt?: unknown };
    if (!isNonEmptyString(body.receipt)) {
      return reply.code(400).send({ error: 'INVALID_RECEIPT', message: 'A store receipt is required.' });
    }
    await store.ensure(device.deviceId, device.platform);
    return store.grantPremium(device.deviceId);
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    streetlevel: {
      config: ServerConfig;
      store: AccountStore;
      alerts: AlertProvider;
      geocoder: Geocoder;
      nim: NimClient;
    };
  }
}

export type { FastifyReply };
