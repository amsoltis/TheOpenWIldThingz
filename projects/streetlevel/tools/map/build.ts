/**
 * Builds the interactive system map.
 *
 *   npm run map
 *
 * Projects the committed station graph into a compact payload and injects it
 * into the page, so the map is always a picture of the dataset the router
 * actually uses rather than a separately-maintained diagram. If a station moves
 * or a line stops running, this moves with it.
 *
 * The built page is git-ignored; the template and this script are the source.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadNetwork } from '@streetlevel/data';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, 'generated');

async function main(): Promise<void> {
  const network = loadNetwork();

  // Positional arrays rather than objects: the payload is inlined into the page
  // and keys repeated 475 times are most of the weight.
  const stations: Record<string, unknown[]> = {};
  for (const s of Object.values(network.stations)) {
    stations[s.id] = [
      s.name,
      Number(s.latitude.toFixed(5)),
      Number(s.longitude.toFixed(5)),
      s.lines.join(''),
      s.complexId,
      s.borough,
    ];
  }

  const edges = network.edges.map((e) => [
    e.from, e.to, e.line, e.seconds, e.direction, e.headsign,
    e.service.weekday, e.service.weekend, e.service.lateNight,
  ]);

  // Same-station entries are a platform change, not a walk between places.
  const transfers = network.transfers
    .filter((t) => t.from !== t.to)
    .map((t) => [t.from, t.to, t.seconds]);

  const payload = JSON.stringify({
    meta: { feedVersion: network.meta.feedVersion, feedEnd: network.meta.feedEndDate },
    stations,
    edges,
    transfers,
  });

  const template = await readFile(path.join(here, 'template.html'), 'utf8');
  if (!template.includes('__DATA__')) {
    throw new Error('template.html has no __DATA__ placeholder to inject into');
  }

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'map.html');
  await writeFile(outPath, template.replace('__DATA__', payload), 'utf8');

  process.stdout.write(
    [
      '',
      `  stations   ${Object.keys(stations).length}`,
      `  hops       ${edges.length}`,
      `  transfers  ${transfers.length}`,
      `  payload    ${(payload.length / 1024).toFixed(0)} KB`,
      `  page       ${((template.length + payload.length) / 1024).toFixed(0)} KB → ${outPath}`,
      '',
    ].join('\n'),
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
