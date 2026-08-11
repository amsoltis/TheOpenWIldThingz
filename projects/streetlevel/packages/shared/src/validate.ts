/**
 * Runtime validation for the wire contract.
 *
 * Hand-written rather than schema-library-driven for two reasons: this module
 * is imported by the Expo client (every dependency is bundle weight carried
 * onto a phone), and the validator's real job is guarding against a *language
 * model* returning plausible-looking nonsense. That calls for specific,
 * readable failure messages we can log and act on, not a generic schema trace.
 *
 * TypeScript types vanish at runtime. A packet arriving from the network — and
 * especially one shaped by an LLM — is untrusted until it has been through
 * here.
 */

import type {
  JourneyLeg,
  RouteCard,
  StreetEntranceNode,
  TransitPacket,
  LineFocusConfig,
  PhaseType,
} from './contract.js';
import { isLineID } from './lines.js';

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

const PHASE_TYPES: readonly PhaseType[] = [
  'ENTRANCE_APPROACH',
  'MEZZANINE_TRANSIT',
  'PLATFORM_WAIT',
  'ON_TRAIN',
  'EXIT_SURFACING',
];

const CORNER_CODES = ['NW', 'NE', 'SW', 'SE'] as const;
const HAPTICS = ['LIGHT_TAP', 'DOUBLE_JOLT', 'CONTINUOUS_ALERT'] as const;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isIsoDateTime(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}

function checkStringArray(
  v: unknown,
  path: string,
  errors: string[],
  { minLength = 0 }: { minLength?: number } = {},
): string[] {
  if (!Array.isArray(v)) {
    errors.push(`${path}: expected an array of strings`);
    return [];
  }
  const bad = v.findIndex((item) => typeof item !== 'string');
  if (bad !== -1) errors.push(`${path}[${bad}]: expected a string`);
  if (v.length < minLength) {
    errors.push(`${path}: expected at least ${minLength} entries, got ${v.length}`);
  }
  return v.filter((item): item is string => typeof item === 'string');
}

function validateLineFocus(v: unknown, path: string, errors: string[]): void {
  if (!isRecord(v)) {
    errors.push(`${path}: expected an object`);
    return;
  }
  if (!isLineID(v['activeLineId'])) {
    errors.push(`${path}.activeLineId: ${JSON.stringify(v['activeLineId'])} is not a subway line`);
  }
  if (typeof v['activeLineColor'] !== 'string' || !HEX_RE.test(v['activeLineColor'])) {
    errors.push(`${path}.activeLineColor: expected #RRGGBB, got ${JSON.stringify(v['activeLineColor'])}`);
  }
  const dim = v['coLocatedLinesToDim'];
  if (!Array.isArray(dim)) {
    errors.push(`${path}.coLocatedLinesToDim: expected an array`);
  } else {
    dim.forEach((line, i) => {
      if (!isLineID(line)) {
        errors.push(`${path}.coLocatedLinesToDim[${i}]: ${JSON.stringify(line)} is not a subway line`);
      }
    });
    if (isLineID(v['activeLineId']) && dim.includes(v['activeLineId'])) {
      // Dimming the line the traveller is waiting for would actively mislead them.
      errors.push(`${path}.coLocatedLinesToDim: must not contain the active line ${v['activeLineId']}`);
    }
  }
  const car = v['expectedTrainCarIndex'];
  if (typeof car !== 'number' || !Number.isInteger(car) || car < 1 || car > 11) {
    // NYC trains run 8–11 cars; an index outside that is a shaping bug that
    // would send someone walking off the end of a platform.
    errors.push(`${path}.expectedTrainCarIndex: expected an integer car position 1–11, got ${JSON.stringify(car)}`);
  }
  if (!isNonEmptyString(v['platformPositioningText'])) {
    errors.push(`${path}.platformPositioningText: required non-empty string`);
  }
}

export function validateRouteCard(v: unknown, path = 'card'): ValidationResult<RouteCard> {
  const errors: string[] = [];
  if (!isRecord(v)) {
    return { ok: false, errors: [`${path}: expected an object`] };
  }
  if (!isNonEmptyString(v['cardId'])) errors.push(`${path}.cardId: required non-empty string`);
  if (typeof v['phaseOrder'] !== 'number' || !Number.isInteger(v['phaseOrder'])) {
    errors.push(`${path}.phaseOrder: required integer`);
  }
  if (!PHASE_TYPES.includes(v['phaseType'] as PhaseType)) {
    errors.push(`${path}.phaseType: ${JSON.stringify(v['phaseType'])} is not one of ${PHASE_TYPES.join(', ')}`);
  }
  if (!isNonEmptyString(v['primaryInstructionMarkdown'])) {
    errors.push(`${path}.primaryInstructionMarkdown: required non-empty string`);
  }
  checkStringArray(v['visualAnchors'], `${path}.visualAnchors`, errors);

  if (v['targetLineFocus'] !== undefined) {
    validateLineFocus(v['targetLineFocus'], `${path}.targetLineFocus`, errors);
  }
  if (v['connectorFocus'] !== undefined) {
    const c = v['connectorFocus'];
    if (!isRecord(c)) {
      errors.push(`${path}.connectorFocus: expected an object`);
    } else {
      for (const key of ['connectorName', 'connectorColor', 'connectorTextColor', 'signpostedAs']) {
        if (!isNonEmptyString(c[key])) {
          errors.push(`${path}.connectorFocus.${key}: required non-empty string`);
        }
      }
    }
    // The two focus blocks answer the same question — what owns this screen —
    // and a card carrying both would leave the client picking. A connector is
    // not a train; that is the entire reason the field exists.
    if (v['targetLineFocus'] !== undefined) {
      errors.push(`${path}: a card cannot carry both targetLineFocus and connectorFocus`);
    }
  }
  if (v['criticalAvoidanceNotes'] !== undefined && typeof v['criticalAvoidanceNotes'] !== 'string') {
    errors.push(`${path}.criticalAvoidanceNotes: expected a string`);
  }
  if (
    v['hapticPatternTrigger'] !== undefined &&
    !HAPTICS.includes(v['hapticPatternTrigger'] as (typeof HAPTICS)[number])
  ) {
    errors.push(`${path}.hapticPatternTrigger: ${JSON.stringify(v['hapticPatternTrigger'])} is not a known pattern`);
  }
  if (v['offlineSensorValidation'] !== undefined) {
    const s = v['offlineSensorValidation'];
    if (!isRecord(s)) {
      errors.push(`${path}.offlineSensorValidation: expected an object`);
    } else {
      if (typeof s['expectedTunnelTransitCount'] !== 'number') {
        errors.push(`${path}.offlineSensorValidation.expectedTunnelTransitCount: required number`);
      }
      if (!isNonEmptyString(s['expectedNextStationNodeName'])) {
        errors.push(`${path}.offlineSensorValidation.expectedNextStationNodeName: required non-empty string`);
      }
    }
  }

  // A platform-wait card without line focus is the exact moment the traveller
  // needs to know which train to board, so treat the omission as fatal.
  if (v['phaseType'] === 'PLATFORM_WAIT' && v['targetLineFocus'] === undefined) {
    errors.push(`${path}: PLATFORM_WAIT cards must carry targetLineFocus (which train am I boarding?)`);
  }

  if (v['stopLadder'] !== undefined) {
    const ladder = v['stopLadder'];
    if (!isRecord(ladder)) {
      errors.push(`${path}.stopLadder: expected an object`);
    } else {
      const stops = checkStringArray(ladder['stops'], `${path}.stopLadder.stops`, errors, { minLength: 2 });
      const alightIndex = ladder['alightIndex'];
      if (typeof alightIndex !== 'number' || !Number.isInteger(alightIndex)) {
        errors.push(`${path}.stopLadder.alightIndex: required integer`);
      } else if (alightIndex <= 0 || alightIndex >= stops.length) {
        // Off the end of the ladder means the UI would highlight nothing, or
        // highlight the station they are standing in as their destination.
        errors.push(
          `${path}.stopLadder.alightIndex: ${alightIndex} is outside the ${stops.length} stops listed`,
        );
      }
    }
  }
  if (v['phaseType'] === 'ON_TRAIN' && v['stopLadder'] === undefined) {
    errors.push(`${path}: ON_TRAIN cards must carry stopLadder (which stops am I counting?)`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: v as unknown as RouteCard, errors: [] };
}

function validateEntrance(v: unknown, path: string, errors: string[]): void {
  if (!isRecord(v)) {
    errors.push(`${path}: expected an object`);
    return;
  }
  if (!isNonEmptyString(v['entranceId'])) errors.push(`${path}.entranceId: required non-empty string`);
  if (!isNonEmptyString(v['streetIntersectionText'])) {
    errors.push(`${path}.streetIntersectionText: required non-empty string`);
  }
  if (!CORNER_CODES.includes(v['geographicCornerCode'] as (typeof CORNER_CODES)[number])) {
    errors.push(`${path}.geographicCornerCode: expected one of ${CORNER_CODES.join(', ')}`);
  }
  if (!isNonEmptyString(v['visualLandmarkCue'])) {
    errors.push(`${path}.visualLandmarkCue: required — the entrance lock screen has nothing to show without it`);
  }
  const lat = v['latitude'];
  const lon = v['longitude'];
  // Bounding box around the NYC subway footprint. A coordinate outside it means
  // the shaper hallucinated a location, and the offline map would pan to sea.
  if (typeof lat !== 'number' || lat < 40.4 || lat > 41.0) {
    errors.push(`${path}.latitude: ${JSON.stringify(lat)} is outside the NYC service area`);
  }
  if (typeof lon !== 'number' || lon < -74.3 || lon > -73.6) {
    errors.push(`${path}.longitude: ${JSON.stringify(lon)} is outside the NYC service area`);
  }
}

export function validateJourneyLeg(v: unknown, path = 'leg'): ValidationResult<JourneyLeg> {
  const errors: string[] = [];
  if (!isRecord(v)) return { ok: false, errors: [`${path}: expected an object`] };

  const dur = v['totalEstimatedDurationMinutes'];
  if (typeof dur !== 'number' || !Number.isInteger(dur) || dur <= 0) {
    errors.push(`${path}.totalEstimatedDurationMinutes: expected a positive integer`);
  }
  validateEntrance(v['initialStreetEntrance'], `${path}.initialStreetEntrance`, errors);

  const cards = v['navigationCards'];
  if (!Array.isArray(cards)) {
    errors.push(`${path}.navigationCards: expected an array`);
  } else if (cards.length === 0) {
    errors.push(`${path}.navigationCards: a journey with no cards is not navigable`);
  } else {
    cards.forEach((card, i) => {
      const res = validateRouteCard(card, `${path}.navigationCards[${i}]`);
      errors.push(...res.errors);
    });
    // The deck is swiped strictly linearly, so gaps or repeats in phaseOrder
    // would strand the traveller mid-deck.
    const orders = cards
      .filter(isRecord)
      .map((c) => c['phaseOrder'])
      .filter((o): o is number => typeof o === 'number');
    const sorted = [...orders].sort((a, b) => a - b);
    const expected = orders.map((_, i) => i + 1);
    if (sorted.length === expected.length && sorted.some((o, i) => o !== expected[i])) {
      errors.push(`${path}.navigationCards: phaseOrder must be 1..n with no gaps or repeats, got [${sorted.join(', ')}]`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: v as unknown as JourneyLeg, errors: [] };
}

export function validateTransitPacket(v: unknown): ValidationResult<TransitPacket> {
  const errors: string[] = [];
  if (!isRecord(v)) return { ok: false, errors: ['packet: expected an object'] };

  if (!isNonEmptyString(v['packetId'])) errors.push('packet.packetId: required non-empty string');
  if (!isIsoDateTime(v['compiledAt'])) errors.push('packet.compiledAt: required ISO-8601 timestamp');
  if (v['expiresAt'] !== undefined && !isIsoDateTime(v['expiresAt'])) {
    errors.push('packet.expiresAt: expected an ISO-8601 timestamp');
  }
  if (typeof v['isMaintenanceDiverted'] !== 'boolean') {
    errors.push('packet.isMaintenanceDiverted: required boolean');
  }
  errors.push(...validateJourneyLeg(v['outboundJourney'], 'packet.outboundJourney').errors);
  errors.push(...validateJourneyLeg(v['returnJourney'], 'packet.returnJourney').errors);

  return errors.length ? { ok: false, errors } : { ok: true, value: v as unknown as TransitPacket, errors: [] };
}

/** Convenience for server-side logging and test assertions. */
export function assertValidPacket(v: unknown): TransitPacket {
  const res = validateTransitPacket(v);
  if (!res.ok || !res.value) {
    throw new Error(`Invalid TransitPacket:\n  - ${res.errors.join('\n  - ')}`);
  }
  return res.value;
}

export type { LineFocusConfig, StreetEntranceNode };
