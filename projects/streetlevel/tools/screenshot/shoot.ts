/**
 * Bundles the harness and photographs it.
 *
 *   npm run screenshot
 *
 * `react-native` is aliased to `react-native-web` and the five Expo native
 * modules to local stubs, so the real screen components render in a browser.
 * Nothing in `mobile/` is modified to make this work — if a screen needs a
 * change to render here, that is a finding, not something to paper over.
 */
import { existsSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, 'generated');

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

async function bundle(): Promise<void> {
  await esbuild.build({
    entryPoints: [path.join(here, 'entry.tsx')],
    bundle: true,
    outfile: path.join(OUT_DIR, 'bundle.js'),
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    loader: { '.js': 'jsx' },
    define: {
      'process.env.NODE_ENV': '"production"',
      __DEV__: 'false',
    },
    alias: {
      'react-native': 'react-native-web',
      'expo-haptics': path.join(here, 'stubs/expo-haptics.ts'),
      'expo-application': path.join(here, 'stubs/expo-application.ts'),
      'expo-constants': path.join(here, 'stubs/expo-constants.ts'),
      'expo-sqlite': path.join(here, 'stubs/expo-sqlite.ts'),
      'expo-status-bar': path.join(here, 'stubs/expo-status-bar.tsx'),
    },
    logLevel: 'warning',
  });
}

/**
 * Some environments ship a Chromium that does not match the build this
 * Playwright release would fetch. Pointing at the installed binary is better
 * than downloading a second copy, so CHROMIUM_PATH (or a conventional install
 * location) wins when present.
 */
function resolveChromium(): string | undefined {
  const fromEnv = process.env['CHROMIUM_PATH'];
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const root = process.env['PLAYWRIGHT_BROWSERS_PATH'] ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith('chromium-')) continue;
    const candidate = path.join(root, dir, 'chrome-linux', 'chrome');
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function shoot(): Promise<void> {
  const executablePath = resolveChromium();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });

  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(msg.text());
  });
  page.on('pageerror', (err) => problems.push(err.message));

  await page.goto(`file://${path.join(here, 'index.html')}`, { waitUntil: 'load' });
  await page.waitForSelector('#root > *', { timeout: 15_000 });
  // react-native-web injects its stylesheet on mount; give layout a beat to settle.
  await page.waitForTimeout(600);

  const gallery = page.locator('#root');
  await gallery.screenshot({ path: path.join(OUT_DIR, 'screens.png') });

  // Individual frames, so a single screen can be looked at properly.
  const phones = page.locator('#root [data-phone]');
  const count = await phones.count();
  for (let i = 0; i < count; i++) {
    await phones.nth(i).screenshot({ path: path.join(OUT_DIR, `screen-${i + 1}.png`) });
  }

  await browser.close();

  if (problems.length > 0) {
    process.stderr.write(`\nRendering reported ${problems.length} problem(s):\n`);
    for (const p of problems.slice(0, 10)) process.stderr.write(`  - ${p}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `\nWrote ${path.join(OUT_DIR, 'screens.png')}` +
      (count > 0 ? ` and ${count} individual frames (${PHONE_WIDTH}×${PHONE_HEIGHT})` : '') +
      '\n',
  );
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await bundle();
  await shoot();
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
