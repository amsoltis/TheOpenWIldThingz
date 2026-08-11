import type { PaywallSku } from '@streetlevel/shared';

export interface ServerConfig {
  port: number;
  host: string;
  /** Free round-trip packets granted to a new device. */
  freeCredits: number;
  databaseUrl?: string;
  /** Where planned service changes are read from; empty means none. */
  alertsUrl?: string;
  alertsFile?: string;
  alertsRefreshMs: number;
  skus: PaywallSku[];
}

export const DEFAULT_SKUS: PaywallSku[] = [
  {
    platformSkuString: 'house.soltis.streetlevel.cityexplorerpass',
    localizedPriceText: '$4.99',
    tierDescription: 'City Explorer Pass — unlimited offline trip packets, one payment, no subscription.',
  },
];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env['PORT'] ?? 8080),
    host: env['HOST'] ?? '0.0.0.0',
    freeCredits: Number(env['FREE_CREDITS'] ?? 3),
    databaseUrl: env['DATABASE_URL']?.trim() || undefined,
    alertsUrl: env['ALERTS_URL']?.trim() || undefined,
    alertsFile: env['ALERTS_FILE']?.trim() || undefined,
    alertsRefreshMs: Number(env['ALERTS_REFRESH_MS'] ?? 12 * 60 * 60 * 1000),
    skus: DEFAULT_SKUS,
  };
}
