import type { HexColor, LineID } from './contract.js';

/**
 * Official MTA line colours, lifted from `route_color` in the agency's own
 * GTFS static feed (feed version 20260807). These are the physical colours on
 * the signage and the train bullets — the whole point of the colour system is
 * that what the traveller sees on screen matches what is hanging over their
 * head, so these must never be hand-tweaked for aesthetics.
 */
export const LINE_COLORS: Record<LineID, HexColor> = {
  '1': '#D82233', '2': '#D82233', '3': '#D82233',
  '4': '#009952', '5': '#009952', '6': '#009952',
  '7': '#9A38A1',
  A: '#0062CF', C: '#0062CF', E: '#0062CF',
  B: '#EB6800', D: '#EB6800', F: '#EB6800', M: '#EB6800',
  G: '#799534',
  J: '#8E5C33', Z: '#8E5C33',
  L: '#7C858C',
  N: '#F6BC26', Q: '#F6BC26', R: '#F6BC26', W: '#F6BC26',
  S: '#7C858C',
};

/**
 * Text colour that meets contrast on top of the bullet. The Broadway (yellow)
 * lines are the only ones that take black text — same as the physical bullets.
 */
export const LINE_TEXT_COLORS: Record<LineID, HexColor> = {
  '1': '#FFFFFF', '2': '#FFFFFF', '3': '#FFFFFF',
  '4': '#FFFFFF', '5': '#FFFFFF', '6': '#FFFFFF',
  '7': '#FFFFFF',
  A: '#FFFFFF', C: '#FFFFFF', E: '#FFFFFF',
  B: '#FFFFFF', D: '#FFFFFF', F: '#FFFFFF', M: '#FFFFFF',
  G: '#FFFFFF',
  J: '#FFFFFF', Z: '#FFFFFF',
  L: '#FFFFFF',
  N: '#000000', Q: '#000000', R: '#000000', W: '#000000',
  S: '#FFFFFF',
};

/**
 * Plain-English colour names. Tourists do not read "the BMT Broadway Line";
 * they read "the yellow N". Used for the peripheral-dimming copy, e.g.
 * "You will see red trains pulling in here. Let them pass."
 */
export const LINE_COLOR_NAMES: Record<LineID, string> = {
  '1': 'red', '2': 'red', '3': 'red',
  '4': 'green', '5': 'green', '6': 'green',
  '7': 'purple',
  A: 'blue', C: 'blue', E: 'blue',
  B: 'orange', D: 'orange', F: 'orange', M: 'orange',
  G: 'light green',
  J: 'brown', Z: 'brown',
  L: 'grey',
  N: 'yellow', Q: 'yellow', R: 'yellow', W: 'yellow',
  S: 'grey',
};

export const ALL_LINE_IDS: readonly LineID[] = Object.keys(LINE_COLORS) as LineID[];

const LINE_ID_SET = new Set<string>(ALL_LINE_IDS);

export function isLineID(value: unknown): value is LineID {
  return typeof value === 'string' && LINE_ID_SET.has(value);
}

/**
 * GTFS carries rush-hour express variants as their own routes (`6X`, `7X`,
 * `FX`) and the three shuttles as `GS` / `FS` / `H`. Travellers never see those
 * strings — the bullet on the train reads `6`, `7`, `F`, `S` — so we fold them
 * down to what is physically printed on the train.
 */
export function normaliseGtfsRouteId(routeId: string): LineID | null {
  const direct = routeId.toUpperCase();
  if (LINE_ID_SET.has(direct)) return direct as LineID;
  switch (direct) {
    case '6X': return '6';
    case '7X': return '7';
    case 'FX': return 'F';
    case 'GS':
    case 'FS':
    case 'H':
      return 'S';
    // The Staten Island Railway is a different mode with its own fare gates and
    // a ferry transfer; it is deliberately out of scope rather than mislabelled.
    case 'SI':
    case 'SIR':
      return null;
    default:
      return null;
  }
}

/**
 * Lines sharing physical track/platform space. Used to populate
 * `coLocatedLinesToDim`: the traveller will physically watch these pull into
 * the same platform, so the UI must acknowledge them and dim them rather than
 * pretend they do not exist.
 */
export const TRUNK_GROUPS: readonly (readonly LineID[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['A', 'C', 'E'],
  ['B', 'D', 'F', 'M'],
  ['N', 'Q', 'R', 'W'],
  ['J', 'Z'],
];

export function trunkSiblings(line: LineID): LineID[] {
  const group = TRUNK_GROUPS.find((g) => g.includes(line));
  return group ? group.filter((l) => l !== line) : [];
}
