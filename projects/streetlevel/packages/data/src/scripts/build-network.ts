/**
 * Compiles the unpacked GTFS feed into `generated/network.json` — the station
 * graph the router walks.
 *
 *   npm run build:dataset --workspace=@streetlevel/data
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildNetwork } from '../build-network.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const GTFS_DIR = path.resolve(here, '../../vendor/gtfs');
const OUT_DIR = path.resolve(here, '../../generated');

async function main(): Promise<void> {
  process.stdout.write(`Reading GTFS from ${GTFS_DIR}\n`);
  const started = Date.now();
  const network = await buildNetwork({ gtfsDir: GTFS_DIR });

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'network.json');
  await writeFile(outPath, `${JSON.stringify(network, null, 0)}\n`, 'utf8');

  const lines = new Set(network.edges.map((e) => e.line));
  const withSkips = network.edges.filter((e) => e.passesWithoutStopping.length > 0).length;
  const complexes = new Set(Object.values(network.stations).map((s) => s.complexId));

  process.stdout.write(
    [
      '',
      `  feed version     ${network.meta.feedVersion}`,
      `  feed valid       ${network.meta.feedStartDate} → ${network.meta.feedEndDate}`,
      `  stations         ${network.meta.stationCount}`,
      `  station complexes${String(complexes.size).padStart(4)}`,
      `  track edges      ${network.meta.edgeCount}`,
      `  express hops     ${withSkips} (carry pass-through station names)`,
      `  transfers        ${network.transfers.length}`,
      `  lines            ${[...lines].sort().join(' ')}`,
      `  written to       ${outPath}`,
      `  elapsed          ${((Date.now() - started) / 1000).toFixed(1)}s`,
      '',
    ].join('\n'),
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
