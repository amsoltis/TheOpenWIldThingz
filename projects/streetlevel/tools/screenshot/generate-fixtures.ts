/**
 * Produces the data the screenshot harness renders.
 *
 * Everything here comes out of the real pipeline — the same compiler the API
 * serves and the same resolver the recovery endpoint calls. The screenshots are
 * therefore pictures of real output, not of hand-written sample copy, which is
 * the only version worth looking at when judging whether the instructions read
 * well.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GazetteerGeocoder } from '@streetlevel/data';
import { compilePacket, resolveAndRecover } from '@streetlevel/shaper';
import { assertValidPacket } from '@streetlevel/shared';

const here = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const geocoder = new GazetteerGeocoder();

  const packet = await compilePacket({
    originAddress: 'Times Square',
    destinationAddress: 'Brooklyn Botanic Garden',
    departAt: '2026-08-11T14:00:00-04:00',
    // A late return, so the divergence warning is visible in the screenshots.
    returnAt: '2026-08-12T01:30:00-04:00',
    geocoder,
    packetId: 'pkt_demo',
    now: new Date('2026-08-11T13:30:00-04:00'),
  });
  assertValidPacket(packet);

  const recovery = await resolveAndRecover(
    {
      surroundingsDescription:
        'I got off the L train and the sign on the wall says Bedford Av but I need to get to the museum',
      intendedDestinationAddress: 'The Met',
    },
    { geocoder, at: new Date('2026-08-11T14:20:00-04:00') },
  );

  const paywall = {
    statusCode: 402 as const,
    errorType: 'QUOTA_EXHAUSTED' as const,
    message:
      "You've used your 3 free navigation keys. Unlock lifetime access to the Plain-English NYC " +
      'Subway Engine to instantly open your custom, offline walkthrough to the Morgan Library.',
    targetSkus: [
      {
        platformSkuString: 'house.soltis.streetlevel.cityexplorerpass',
        localizedPriceText: '$4.99',
        tierDescription:
          'City Explorer Pass — unlimited offline trip packets, one payment, no subscription.',
      },
    ],
  };

  await mkdir(path.join(here, 'generated'), { recursive: true });
  await writeFile(
    path.join(here, 'generated', 'fixtures.json'),
    `${JSON.stringify({ packet, recovery, paywall }, null, 2)}\n`,
    'utf8',
  );

  const phases = packet.outboundJourney.navigationCards.map((c) => c.phaseType).join(', ');
  process.stdout.write(
    `fixtures written\n  outbound cards: ${phases}\n  recovery confidence: ${recovery.confidence.toFixed(2)} (${recovery.resolvedStationName})\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
