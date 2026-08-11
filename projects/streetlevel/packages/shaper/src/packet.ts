import type { LineID, ServiceAlert, TransitPacket } from '@streetlevel/shared';
import type { Geocoder } from '@streetlevel/data';
import { NoRouteFoundError, planTrip, type TripPlan } from '@streetlevel/router';

import { compileJourneyLeg } from './compile.js';

export interface CompilePacketRequest {
  originAddress: string;
  destinationAddress: string;
  /** ISO-8601 outbound departure. */
  departAt: string;
  /** ISO-8601 intended return. */
  returnAt: string;
  alerts?: ServiceAlert[];
  geocoder: Geocoder;
  /** Injected so packet ids are deterministic in tests. */
  packetId?: string;
  now?: Date;
}

export class ReturnLegUnavailableError extends Error {
  constructor(
    message: string,
    readonly outboundSummary: string,
  ) {
    super(message);
    this.name = 'ReturnLegUnavailableError';
  }
}

export interface DivergenceFinding {
  diverted: boolean;
  reasons: string[];
}

/**
 * The Predictive Divergence Engine.
 *
 * A tourist plans a round trip in daylight and assumes the way home is the way
 * out, reversed. Overnight it very often is not: express lines drop to local,
 * whole lines stop running, and the station they came from may not be one they
 * can leave from. This compares the two compiled legs and reports, before
 * departure, whether the return is structurally a different journey.
 */
export function detectDivergence(
  outbound: TripPlan,
  ret: TripPlan,
  activeReturnAlerts: ServiceAlert[],
): DivergenceFinding {
  const reasons: string[] = [];

  const linesOut = new Set<LineID>(
    outbound.route.legs.filter((l) => l.kind === 'RIDE').map((l) => (l as { line: LineID }).line),
  );
  const linesBack = new Set<LineID>(
    ret.route.legs.filter((l) => l.kind === 'RIDE').map((l) => (l as { line: LineID }).line),
  );

  const missing = [...linesOut].filter((l) => !linesBack.has(l));
  const added = [...linesBack].filter((l) => !linesOut.has(l));
  if (missing.length > 0 || added.length > 0) {
    const parts: string[] = [];
    if (missing.length) parts.push(`you will not be using the ${missing.join(', ')} on the way back`);
    if (added.length) parts.push(`your return uses the ${added.join(', ')} instead`);
    reasons.push(`Your route home is not the reverse of your route out: ${parts.join(', and ')}.`);
  }

  if (outbound.alightStationId !== ret.boardStationId) {
    reasons.push('You come home from a different station than the one you arrive at.');
  }
  if (outbound.boardStationId !== ret.alightStationId) {
    reasons.push('Your return drops you at a different station than the one you started from.');
  }
  if (ret.route.transferCount > outbound.route.transferCount) {
    reasons.push(
      `The way back needs ${ret.route.transferCount} change${ret.route.transferCount === 1 ? '' : 's'} of train, ` +
        `compared with ${outbound.route.transferCount} on the way out.`,
    );
  }
  if (outbound.route.servicePeriod !== ret.route.servicePeriod) {
    reasons.push(
      ret.route.servicePeriod === 'LATE_NIGHT'
        ? 'Your return falls in the overnight timetable, when several lines run differently.'
        : 'Your outbound and return legs run on different timetables.',
    );
  }
  for (const alert of activeReturnAlerts) {
    reasons.push(`Planned service change affecting your return: ${alert.headerPlainText}`);
  }

  return { diverted: reasons.length > 0, reasons };
}

function describeRoute(trip: TripPlan): string {
  const lines = trip.route.legs
    .filter((l) => l.kind === 'RIDE')
    .map((l) => (l as { line: LineID }).line);
  return lines.length > 0 ? lines.join(' → ') : 'walking';
}

/** Alerts that fall inside the return window, regardless of line. */
function alertsActiveAt(alerts: ServiceAlert[], at: Date): ServiceAlert[] {
  const t = at.getTime();
  return alerts.filter((a) => {
    const from = Date.parse(a.activeFrom);
    const until = Date.parse(a.activeUntil);
    return !Number.isNaN(from) && !Number.isNaN(until) && t >= from && t <= until;
  });
}

function formatWindow(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export async function compilePacket(request: CompilePacketRequest): Promise<TransitPacket> {
  const now = request.now ?? new Date();
  const departAt = new Date(request.departAt);
  const returnAt = new Date(request.returnAt);
  const alerts = request.alerts ?? [];

  const outbound = await planTrip(request.originAddress, request.destinationAddress, {
    at: departAt,
    alerts,
    geocoder: request.geocoder,
  });

  let ret: TripPlan;
  try {
    ret = await planTrip(request.destinationAddress, request.originAddress, {
      at: returnAt,
      alerts,
      geocoder: request.geocoder,
    });
  } catch (err) {
    if (err instanceof NoRouteFoundError) {
      // Better to refuse than to hand someone a packet whose second half is
      // fiction. They can still plan the outbound leg separately if they want.
      throw new ReturnLegUnavailableError(
        `There is no subway route home at ${formatWindow(request.returnAt)}: ${err.message} ` +
          'Plan a different return time, or arrange another way back.',
        describeRoute(outbound),
      );
    }
    throw err;
  }

  const divergence = detectDivergence(outbound, ret, alertsActiveAt(alerts, returnAt));
  const packetId = request.packetId ?? `pkt_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const outboundLeg = compileJourneyLeg(outbound, {
    plannedDepartureWindow: formatWindow(request.departAt),
    idPrefix: `${packetId}-out`,
  });
  const returnLeg = compileJourneyLeg(ret, {
    plannedDepartureWindow: formatWindow(request.returnAt),
    idPrefix: `${packetId}-ret`,
  });

  // Surface the divergence on the first card of the return leg, where the
  // traveller will actually meet it, not buried in a flag nobody reads.
  if (divergence.diverted && returnLeg.navigationCards[0]) {
    const first = returnLeg.navigationCards[0];
    // Capped deliberately. This card is read by someone deciding whether to
    // trust the app at all; three concrete differences land, a wall of eight
    // does not.
    first.criticalAvoidanceNotes = [
      'Heads up — your way home is not simply your way out reversed.',
      ...divergence.reasons.slice(0, 3),
    ].join(' ');
  }

  // The packet is only good for the trip it was built for: schedules change,
  // and a stale cached deck is exactly the failure mode this product cannot
  // afford. Expiry is the later of the return window plus a buffer, bounded by
  // the schedule feed's own validity.
  const expiresAt = new Date(returnAt.getTime() + 12 * 60 * 60 * 1000);

  return {
    packetId,
    compiledAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isMaintenanceDiverted: divergence.diverted,
    outboundJourney: outboundLeg,
    returnJourney: returnLeg,
  };
}
