/**
 * Renders the app icons from the design system rather than from a drawing tool,
 * so the mark cannot drift from the palette the client actually ships.
 *   node tools/icons/build.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../mobile/assets');
const page = (q) => 'file://' + path.join(here, 'mark.html') + '?' + q;

const TARGETS = [
  // Full-bleed store icon.
  { file: 'icon.png', size: 1024, q: 'size=1024&scale=1' },
  // Android masks its adaptive foreground hard, so the mark sits inside the
  // safe zone with the ground supplied by app.json instead.
  { file: 'adaptive-icon.png', size: 1024, q: 'size=1024&scale=0.62&bg=none' },
  // Splash: the same mark, smaller, on the app's own paper.
  { file: 'splash.png', size: 1284, q: 'size=1284&scale=0.42' },
  { file: 'favicon.png', size: 64, q: 'size=64&scale=1' },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
await mkdir(OUT, { recursive: true });

for (const t of TARGETS) {
  const p = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
  await p.goto(page(t.q), { waitUntil: 'load' });
  await p.waitForTimeout(120);
  await p.screenshot({ path: path.join(OUT, t.file), omitBackground: t.q.includes('bg=none') });
  await p.close();
  process.stdout.write(`  ${t.file.padEnd(20)} ${t.size}×${t.size}\n`);
}
await browser.close();
process.stdout.write(`\nWritten to ${OUT}\n`);
