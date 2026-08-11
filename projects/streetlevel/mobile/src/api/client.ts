import { Platform } from 'react-native';
import type {
  PacketRequest,
  RecoveryRequest,
  RecoveryResponse,
  TransitPacket,
  UserBillingProfile,
} from '@streetlevel/shared';
import { validateTransitPacket } from '@streetlevel/shared';

import { ApiError, PacketValidationError, PaywallError, parsePaywallException } from './errors';
import { getDeviceId } from './deviceId';
import { resolveBaseUrl } from '../lib/config';

/**
 * Packet compilation is a multi-second server operation (routing + shaping).
 * The timeout is generous because the alternative — a traveller retrying on a
 * flaky platform connection and burning a second credit — is worse than a wait.
 */
const REQUEST_TIMEOUT_MS = 30_000;

export interface PacketResult {
  packet: TransitPacket;
  billing: UserBillingProfile | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBilling(value: unknown): UserBillingProfile | null {
  if (!isRecord(value)) return null;
  const deviceId = value['deviceId'];
  const creditsRemaining = value['creditsRemaining'];
  const isPremiumUnlocked = value['isPremiumUnlocked'];
  const registrationDate = value['registrationDate'];
  if (typeof deviceId !== 'string' || typeof creditsRemaining !== 'number') return null;
  return {
    deviceId,
    creditsRemaining,
    isPremiumUnlocked: isPremiumUnlocked === true,
    registrationDate: typeof registrationDate === 'string' ? registrationDate : new Date().toISOString(),
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function errorMessageFrom(body: unknown, status: number): string {
  if (isRecord(body) && typeof body['message'] === 'string' && body['message'].trim().length > 0) {
    return body['message'];
  }
  return `The routing service answered ${status}.`;
}

async function post(path: string, body: unknown): Promise<unknown> {
  const deviceId = await getDeviceId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${resolveBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-device-id': deviceId,
        // The meter is per-device and the id spaces differ per platform, so the
        // server is told which one this id came from rather than guessing.
        'x-device-platform': Platform.OS === 'android' ? 'ANDROID' : 'IOS',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    const reason = cause instanceof Error && cause.name === 'AbortError' ? 'timed out' : 'could not be reached';
    throw new ApiError(0, `The routing service ${reason}. Trips you have already downloaded still work offline.`);
  } finally {
    clearTimeout(timer);
  }

  const payload = await readJson(response);

  // 402 is a product state, not a failure: it is the only moment the paywall is
  // ever allowed to appear, so it is thrown as its own type rather than folded
  // into the generic error path.
  if (response.status === 402) {
    throw new PaywallError(parsePaywallException(payload));
  }
  if (!response.ok) {
    throw new ApiError(response.status, errorMessageFrom(payload, response.status));
  }
  return payload;
}

/**
 * The server may answer with a bare TransitPacket or with an envelope carrying
 * the updated billing profile alongside it. Both are accepted because the
 * packet is the part the contract freezes; the meter reading is advisory.
 */
function unwrapPacketPayload(payload: unknown): { candidate: unknown; billing: UserBillingProfile | null } {
  if (isRecord(payload) && 'packet' in payload) {
    return { candidate: payload['packet'], billing: readBilling(payload['billing']) };
  }
  return { candidate: payload, billing: null };
}

export async function requestPacket(request: PacketRequest): Promise<PacketResult> {
  const payload = await post('/v1/packets', request);
  const { candidate, billing } = unwrapPacketPayload(payload);

  // The packet is shaped by a language model upstream. Plausible-looking
  // nonsense — a car index of 47, a leg with no cards — has to die here, loudly,
  // rather than become an instruction someone follows into a tunnel.
  const validation = validateTransitPacket(candidate);
  if (!validation.ok || !validation.value) {
    throw new PacketValidationError(validation.errors);
  }
  return { packet: validation.value, billing };
}

function parseRecoveryResponse(payload: unknown): RecoveryResponse {
  if (!isRecord(payload)) {
    throw new ApiError(502, 'The recovery service sent something we could not read.');
  }
  const resolvedStationId = payload['resolvedStationId'];
  const resolvedStationName = payload['resolvedStationName'];
  const confidence = payload['confidence'];
  const reasoningPlainText = payload['reasoningPlainText'];
  if (typeof resolvedStationId !== 'string' || typeof resolvedStationName !== 'string') {
    throw new ApiError(502, 'The recovery service did not say where you are.');
  }
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    // Without a confidence figure we cannot apply the floor, and routing an
    // already-lost traveller on an unscored guess is the worst thing we can do.
    throw new ApiError(502, 'The recovery service did not say how sure it is, so we will not guess.');
  }

  const cards = payload['recoveryCards'];
  const questions = payload['clarifyingQuestions'];
  const direction = payload['resolvedPlatformDirection'];

  const response: RecoveryResponse = {
    resolvedStationId,
    resolvedStationName,
    confidence,
    reasoningPlainText: typeof reasoningPlainText === 'string' ? reasoningPlainText : '',
    recoveryCards: Array.isArray(cards) ? (cards as RecoveryResponse['recoveryCards']) : [],
  };
  if (typeof direction === 'string') response.resolvedPlatformDirection = direction;
  if (Array.isArray(questions)) {
    response.clarifyingQuestions = questions.filter((q): q is string => typeof q === 'string');
  }
  return response;
}

export async function requestRecovery(request: RecoveryRequest): Promise<RecoveryResponse> {
  const payload = await post('/v1/recover', request);
  return parseRecoveryResponse(payload);
}
