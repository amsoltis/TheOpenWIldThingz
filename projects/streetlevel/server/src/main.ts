import { buildApp } from './app.js';
import { FileAlertProvider, HttpAlertProvider, StaticAlertProvider, type AlertProvider } from './alerts.js';
import { InMemoryAccountStore, PostgresAccountStore, type AccountStore } from './billing.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig();

  let store: AccountStore;
  if (config.databaseUrl) {
    const postgres = new PostgresAccountStore(config.databaseUrl, config.freeCredits);
    await postgres.migrate();
    store = postgres;
  } else {
    process.stdout.write(
      'DATABASE_URL is not set — running with an in-memory account store. Credit balances will not survive a restart.\n',
    );
    store = new InMemoryAccountStore(config.freeCredits);
  }

  let alerts: AlertProvider;
  if (config.alertsUrl) alerts = new HttpAlertProvider(config.alertsUrl);
  else if (config.alertsFile) alerts = new FileAlertProvider(config.alertsFile);
  else alerts = new StaticAlertProvider([]);
  await alerts.refresh();

  // The twice-daily refresh the sync design calls for. Unref'd so it never
  // holds the process open during a shutdown.
  const timer = setInterval(() => {
    void alerts.refresh();
  }, config.alertsRefreshMs);
  timer.unref();

  const app = await buildApp({ config, store, alerts });
  await app.listen({ port: config.port, host: config.host });
  process.stdout.write(`Streetlevel API listening on ${config.host}:${config.port}\n`);

  const shutdown = async (signal: string) => {
    process.stdout.write(`\n${signal} received, shutting down.\n`);
    clearInterval(timer);
    await app.close();
    await store.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
