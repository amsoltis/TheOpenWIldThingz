/**
 * Prints a compiled card deck to the terminal.
 *
 *   npm run demo
 *   npm run demo -- "Astoria" "Wall Street" --return 2026-08-12T01:30:00-04:00
 *
 * Everything printed comes out of the same compiler the API serves, so this is
 * the fastest way to see whether a change made the instructions better or worse
 * without a phone in the loop.
 */
import { GazetteerGeocoder } from '@streetlevel/data';
import { NoRouteFoundError } from '@streetlevel/router';
import { compilePacket, ReturnLegUnavailableError } from '@streetlevel/shaper';
import { assertValidPacket, LINE_COLORS, type JourneyLeg, type TransitPacket } from '@streetlevel/shared';

const RESET = '[0m';
const BOLD = '[1m';
const DIM = '[2m';
const RED = '[31m';

/** Renders the line bullet in its real MTA colour, so the terminal shows what
 *  the traveller's screen would. */
function bullet(line: string): string {
  const hex = LINE_COLORS[line as keyof typeof LINE_COLORS];
  if (!hex) return `(${line})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const fg = line === 'N' || line === 'Q' || line === 'R' || line === 'W' ? '30' : '97';
  return `[48;2;${r};${g};${b}m[${fg}m ${line} ${RESET}`;
}

function renderMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`);
}

function printLeg(title: string, leg: JourneyLeg): void {
  process.stdout.write(`\n${BOLD}${title}${RESET}  ${DIM}${leg.totalEstimatedDurationMinutes} min · ${leg.plannedDepartureWindow}${RESET}\n`);
  process.stdout.write(`${DIM}${'─'.repeat(72)}${RESET}\n`);

  const entrance = leg.initialStreetEntrance;
  process.stdout.write(`${DIM}ENTRANCE LOCK${RESET}  ${entrance.streetIntersectionText} · corner ${entrance.geographicCornerCode}\n`);
  process.stdout.write(`  ${entrance.visualLandmarkCue}\n`);

  for (const card of leg.navigationCards) {
    const focus = card.targetLineFocus;
    const tag = focus ? ` ${bullet(focus.activeLineId)}` : '';
    process.stdout.write(`\n${DIM}[${card.phaseOrder}] ${card.phaseType}${RESET}${tag}\n`);
    process.stdout.write(`  ${renderMarkdown(card.primaryInstructionMarkdown).replace(/\n+/g, '\n  ')}\n`);
    for (const anchor of card.visualAnchors) process.stdout.write(`${DIM}   · ${anchor}${RESET}\n`);
    if (card.criticalAvoidanceNotes) {
      process.stdout.write(`${RED}   ! ${card.criticalAvoidanceNotes}${RESET}\n`);
    }
    if (focus && focus.coLocatedLinesToDim.length > 0) {
      const dimmed = focus.coLocatedLinesToDim.map((l) => `${DIM}(${l})${RESET}`).join(' ');
      process.stdout.write(`     focus ${bullet(focus.activeLineId)}  dimmed ${dimmed}  car ${focus.expectedTrainCarIndex}\n`);
    }
  }
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<void> {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const skipFlagValues = new Set([argValue('--depart'), argValue('--return')].filter(Boolean));
  const places = positional.filter((p) => !skipFlagValues.has(p));

  const originAddress = places[0] ?? 'Times Square';
  const destinationAddress = places[1] ?? 'Brooklyn Botanic Garden';
  const departAt = argValue('--depart') ?? '2026-08-11T14:00:00-04:00';
  const returnAt = argValue('--return') ?? '2026-08-12T01:30:00-04:00';

  process.stdout.write(`${BOLD}${originAddress}${RESET} → ${BOLD}${destinationAddress}${RESET}\n`);

  let packet: TransitPacket;
  try {
    packet = await compilePacket({
      originAddress,
      destinationAddress,
      departAt,
      returnAt,
      geocoder: new GazetteerGeocoder(),
    });
  } catch (err) {
    if (err instanceof ReturnLegUnavailableError || err instanceof NoRouteFoundError) {
      process.stdout.write(`\n${RED}${err.message}${RESET}\n`);
      process.exit(0);
    }
    throw err;
  }

  assertValidPacket(packet);

  printLeg('MY OUTBOUND TRIP', packet.outboundJourney);
  printLeg('MY RETURN HOME', packet.returnJourney);

  process.stdout.write(
    `\n${DIM}packet ${packet.packetId} · ${(JSON.stringify(packet).length / 1024).toFixed(1)} KB cached on device · ` +
      `expires ${packet.expiresAt}${RESET}\n` +
      (packet.isMaintenanceDiverted
        ? `${RED}Return route diverges from the outbound — see the warning on the first return card.${RESET}\n`
        : ''),
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
