/**
 * Downloads the MTA's GTFS static subway feed and unpacks it.
 *
 *   npm run fetch:gtfs --workspace=@streetlevel/data
 *
 * The feed is ~5 MB zipped and is republished as schedules change, so the
 * unpacked copy is deliberately git-ignored: `generated/network.json` is the
 * committed artefact, and it records the feed version it was built from.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { unzipSync } from 'fflate';

import { GTFS_SOURCE_URL } from '../build-network.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const GTFS_DIR = path.resolve(here, '../../vendor/gtfs');

async function main(): Promise<void> {
  process.stdout.write(`Fetching ${GTFS_SOURCE_URL}\n`);
  const res = await fetch(GTFS_SOURCE_URL);
  if (!res.ok) {
    throw new Error(`GTFS download failed: ${res.status} ${res.statusText}`);
  }
  const zipped = new Uint8Array(await res.arrayBuffer());
  process.stdout.write(`  ${(zipped.byteLength / 1_048_576).toFixed(1)} MB downloaded\n`);

  const files = unzipSync(zipped);
  await mkdir(GTFS_DIR, { recursive: true });

  for (const [name, bytes] of Object.entries(files)) {
    if (name.endsWith('/')) continue;
    const target = path.join(GTFS_DIR, path.basename(name));
    await writeFile(target, bytes);
    process.stdout.write(`  ${path.basename(name)} (${(bytes.byteLength / 1024).toFixed(0)} KB)\n`);
  }
  process.stdout.write(`\nUnpacked to ${GTFS_DIR}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
