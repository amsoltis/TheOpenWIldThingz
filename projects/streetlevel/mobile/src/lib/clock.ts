export interface ClockTime {
  hours: number;
  minutes: number;
}

const CLOCK_PATTERN = /^\s*(\d{1,2})(?::?(\d{2}))?\s*([ap]\.?m\.?)?\s*$/i;

/**
 * Accepts what a jet-lagged tourist actually types: "9", "9:30", "0930",
 * "9.30pm", "21:30". A date-picker wheel would be unambiguous but it is four
 * taps and a modal, and this screen is the last thing standing between someone
 * and the trip they came here for.
 */
export function parseClockTime(text: string): ClockTime | null {
  const normalised = text.replace(/\./g, ':').replace(/::/g, ':');
  const match = CLOCK_PATTERN.exec(normalised);
  if (!match) return null;

  const rawHours = Number.parseInt(match[1] ?? '', 10);
  const rawMinutes = match[2] === undefined ? 0 : Number.parseInt(match[2], 10);
  if (!Number.isFinite(rawHours) || !Number.isFinite(rawMinutes)) return null;
  if (rawMinutes > 59) return null;

  const meridiem = match[3]?.toLowerCase().replace(/\./g, '');
  if (meridiem) {
    if (rawHours < 1 || rawHours > 12) return null;
    const base = rawHours % 12;
    return { hours: meridiem.startsWith('p') ? base + 12 : base, minutes: rawMinutes };
  }
  if (rawHours > 23) return null;
  return { hours: rawHours, minutes: rawMinutes };
}

export function formatClockTime(time: ClockTime): string {
  const hh = String(time.hours).padStart(2, '0');
  const mm = String(time.minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * The next occurrence of a wall-clock time at or after `notBefore`.
 *
 * Rolling forward to tomorrow matters for the return leg specifically: the
 * Predictive Divergence Engine checks alerts against the return window, and a
 * 1am return is a different subway system from a 1am that already happened.
 */
export function nextOccurrence(time: ClockTime, notBefore: Date): Date {
  const candidate = new Date(notBefore.getTime());
  candidate.setHours(time.hours, time.minutes, 0, 0);
  if (candidate.getTime() < notBefore.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

export interface TripWindow {
  departAt: string;
  returnAt: string;
}

/**
 * Both timestamps in one place so the return can never be resolved to a moment
 * before the outbound — a packet with an inverted window would have the engine
 * checking service alerts for a trip that has already happened.
 */
export function resolveTripWindow(
  departText: string,
  returnText: string,
  now: Date = new Date(),
): TripWindow | null {
  const depart = parseClockTime(departText);
  const back = parseClockTime(returnText);
  if (!depart || !back) return null;

  const departAt = nextOccurrence(depart, now);
  const returnAt = nextOccurrence(back, departAt);
  return { departAt: departAt.toISOString(), returnAt: returnAt.toISOString() };
}
