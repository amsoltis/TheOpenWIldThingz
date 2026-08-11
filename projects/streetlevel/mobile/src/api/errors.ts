import type { PaywallExceptionResponse, PaywallSku } from '@streetlevel/shared';

/**
 * Deliberately free of any native import so the 402 path can be unit tested
 * without a device: the paywall is the one error branch that must never
 * regress silently, because getting it wrong either blocks a paying customer
 * or gives the product away.
 */

export class PaywallError extends Error {
  readonly response: PaywallExceptionResponse;

  constructor(response: PaywallExceptionResponse) {
    super(response.message);
    this.name = 'PaywallError';
    this.response = response;
  }
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** A packet that failed `validateTransitPacket`. Never rendered — always surfaced. */
export class PacketValidationError extends Error {
  readonly failures: string[];

  constructor(failures: string[]) {
    super(`The trip we received is not navigable:\n  - ${failures.join('\n  - ')}`);
    this.name = 'PacketValidationError';
    this.failures = failures;
  }
}

export function isPaywallError(error: unknown): error is PaywallError {
  return error instanceof PaywallError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSkus(value: unknown): PaywallSku[] {
  if (!Array.isArray(value)) return [];
  const skus: PaywallSku[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const platformSkuString = entry['platformSkuString'];
    const localizedPriceText = entry['localizedPriceText'];
    const tierDescription = entry['tierDescription'];
    if (typeof platformSkuString !== 'string' || platformSkuString.length === 0) continue;
    if (typeof localizedPriceText !== 'string' || localizedPriceText.length === 0) continue;
    skus.push({
      platformSkuString,
      localizedPriceText,
      tierDescription: typeof tierDescription === 'string' ? tierDescription : '',
    });
  }
  return skus;
}

/**
 * What the traveller reads. Stack traces and validator paths go to the log; the
 * screen gets a sentence that says what happened and what still works, because
 * the person reading it may be standing on a street corner with a suitcase.
 */
export function travellerFacingMessage(error: unknown): string {
  if (error instanceof PacketValidationError) {
    return 'The trip we got back did not make sense, so we are not going to send you underground with it. Please try again.';
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Something went wrong building that trip. Trips already on this phone still work.';
}

const FALLBACK_QUOTA_MESSAGE = 'You have used your free navigation keys.';

/**
 * Coerce whatever the server sent with a 402 into the contract shape.
 *
 * This is intentionally forgiving. A malformed 402 body still means "no more
 * credits", and dropping the traveller into a generic error screen at that
 * moment loses a sale and confuses someone standing on a street corner. A
 * paywall with no SKUs still explains why the trip did not compile.
 */
export function parsePaywallException(body: unknown): PaywallExceptionResponse {
  const record = isRecord(body) ? body : {};
  const message = record['message'];
  return {
    statusCode: 402,
    errorType: 'QUOTA_EXHAUSTED',
    message: typeof message === 'string' && message.trim().length > 0 ? message : FALLBACK_QUOTA_MESSAGE,
    targetSkus: parseSkus(record['targetSkus']),
  };
}
