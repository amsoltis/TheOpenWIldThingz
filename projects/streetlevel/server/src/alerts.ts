import { readFile } from 'node:fs/promises';

import type { ServiceAlert } from '@streetlevel/shared';
import { isLineID } from '@streetlevel/shared';

const EFFECTS = new Set(['NO_SERVICE', 'DETOUR', 'STATION_BYPASS', 'REDUCED_SERVICE']);

/**
 * Planned service changes, which the divergence engine checks against the
 * traveller's *return* window rather than their departure.
 */
export interface AlertProvider {
  current(): ServiceAlert[];
  refresh(): Promise<void>;
}

/**
 * Anything crossing this boundary is untrusted, whether it came off disk or off
 * the network. A malformed alert that slipped through would silently delete
 * lines from the graph and produce a confidently wrong route.
 */
export function parseAlerts(payload: unknown): ServiceAlert[] {
  if (!Array.isArray(payload)) return [];
  const out: ServiceAlert[] = [];

  for (const raw of payload) {
    if (typeof raw !== 'object' || raw === null) continue;
    const a = raw as Record<string, unknown>;

    const alertId = typeof a['alertId'] === 'string' ? a['alertId'] : null;
    const effect = typeof a['effect'] === 'string' && EFFECTS.has(a['effect']) ? a['effect'] : null;
    const activeFrom = typeof a['activeFrom'] === 'string' ? a['activeFrom'] : null;
    const activeUntil = typeof a['activeUntil'] === 'string' ? a['activeUntil'] : null;
    if (!alertId || !effect || !activeFrom || !activeUntil) continue;
    if (Number.isNaN(Date.parse(activeFrom)) || Number.isNaN(Date.parse(activeUntil))) continue;

    const affectedLineIds = Array.isArray(a['affectedLineIds'])
      ? a['affectedLineIds'].filter(isLineID)
      : [];
    const affectedStationIds = Array.isArray(a['affectedStationIds'])
      ? a['affectedStationIds'].filter((s): s is string => typeof s === 'string')
      : [];
    // An alert naming nothing cannot be applied to the graph.
    if (affectedLineIds.length === 0 && affectedStationIds.length === 0) continue;

    out.push({
      alertId,
      affectedLineIds,
      affectedStationIds,
      activeFrom,
      activeUntil,
      effect: effect as ServiceAlert['effect'],
      headerPlainText:
        typeof a['headerPlainText'] === 'string' && a['headerPlainText'].trim()
          ? a['headerPlainText']
          : 'Planned service change',
    });
  }
  return out;
}

/** Alerts supplied directly. Used by tests and by fixture-driven local runs. */
export class StaticAlertProvider implements AlertProvider {
  constructor(private alerts: ServiceAlert[] = []) {}

  current(): ServiceAlert[] {
    return this.alerts;
  }

  async refresh(): Promise<void> {}

  set(alerts: ServiceAlert[]): void {
    this.alerts = alerts;
  }
}

/**
 * Reads the file the sync worker writes.
 *
 * This is the shape the spec's twice-daily background job produces: the worker
 * owns talking to the transit authority, and the API server only ever reads a
 * validated local snapshot. Keeping the network call out of the request path is
 * what stops an upstream outage from taking packet compilation down with it.
 */
export class FileAlertProvider implements AlertProvider {
  private alerts: ServiceAlert[] = [];

  constructor(private readonly path: string) {}

  current(): ServiceAlert[] {
    return this.alerts;
  }

  async refresh(): Promise<void> {
    try {
      const raw = await readFile(this.path, 'utf8');
      this.alerts = parseAlerts(JSON.parse(raw));
    } catch {
      // A missing or unreadable snapshot means "no known disruptions", which is
      // the same state as a quiet day. Failing the request instead would take
      // the whole product down every time the worker hiccuped.
      this.alerts = [];
    }
  }
}

/**
 * Polls a URL serving a JSON array of ServiceAlert.
 *
 * NOTE ON UPSTREAM: the transit authority publishes disruptions as GTFS-Realtime
 * protobuf, not as this shape. Translating that feed into ServiceAlert is a
 * separate adapter that belongs in the sync worker, and is deliberately not
 * implemented here — it could not be exercised against the live endpoint from
 * this build environment, and shipping unexercised feed-parsing code would put
 * a silent failure directly upstream of route correctness. This provider is the
 * seam that adapter plugs into.
 */
export class HttpAlertProvider implements AlertProvider {
  private alerts: ServiceAlert[] = [];

  constructor(
    private readonly url: string,
    private readonly timeoutMs = 10_000,
  ) {}

  current(): ServiceAlert[] {
    return this.alerts;
  }

  async refresh(): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, { signal: controller.signal });
      if (!res.ok) return;
      this.alerts = parseAlerts(await res.json());
    } catch {
      // Keep serving the last good snapshot rather than dropping to "no alerts".
    } finally {
      clearTimeout(timer);
    }
  }
}
