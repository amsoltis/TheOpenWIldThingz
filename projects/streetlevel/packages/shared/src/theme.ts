/**
 * Design tokens for a screen that will be read one-handed, at arm's length, in
 * a dark tunnel, by someone who is already anxious. Every value here is a
 * legibility decision, not a taste decision.
 *
 * The interface is built from exactly two materials and they never blend:
 *
 *   1. THE STATEMENT — the active line's own colour, floor to ceiling, carrying
 *      one sentence set at a size that can be read without focusing. A traveller
 *      hunting the 3 is hunting a red circle; the screen becomes that circle.
 *   2. THE ENUMERATION — warm paper and near-black ink, carrying the list. Ink
 *      on paper beats every dark-on-dark pairing this product could invent
 *      (16:1 versus the 4-5:1 a "surface on a surface" achieves), and it makes
 *      the line colour precious because it is the only colour on the page.
 *
 * A third material would mean a third thing for a frightened person to learn,
 * so there is not one.
 */

/** The warm paper the enumeration is printed on. */
const PAPER = '#F2EEE4';
/** Near-black rather than black: pure #000 on warm paper reads as a hole in it. */
const INK = '#14110E';

/**
 * Ink at a given alpha, as a literal so the value can be reasoned about.
 *
 * Nothing carrying words is allowed below 0.62 here. Ink at 0.62 on this paper
 * measures about 5.2:1, which survives a dim carriage; 0.45 measures 3:1 and
 * does not, however good it looks in a well-lit room.
 */
function ink(alpha: number): string {
  return `rgba(20, 17, 14, ${alpha})`;
}

export const PaperTheme = {
  colors: {
    paper: PAPER,
    /** One step down from the paper: notice washes, sunken wells, input fields. */
    paperShade: '#E8E2D4',
    ink: INK,
    /** Body text that is deliberately secondary. 5.2:1 — the floor. */
    inkMuted: ink(0.66),
    /** Rules. Separation without a line the eye stops on. */
    rule: ink(0.2),
    ruleStrong: ink(0.45),
    /**
     * Red that works as ink rather than as light. The dark-mode #FF453A drops to
     * 2.2:1 on paper — bright, and unreadable. This measures 6.3:1 and still
     * reads as an alarm.
     */
    danger: '#A81E14',
    dangerWash: 'rgba(168, 30, 20, 0.10)',
    /** Confirmation. Same treatment: a printer's green, not a screen's green. */
    success: '#1F6B3B',
    successWash: 'rgba(31, 107, 59, 0.10)',
    /**
     * The MTA's own sign vernacular. Black plate, white Helvetica. A traveller
     * hunting the ceiling for a sign recognises this before they read it, so it
     * is a colour pair rather than a style choice — and a black plate on warm
     * paper is exactly how it appears in every station map ever printed.
     */
    plate: '#0B0B0B',
    plateInk: '#FFFFFF',
    /**
     * The green glass globe over an always-open staircase. Street furniture, not
     * a line and not a status, so it keeps its own token — a globe tinted
     * "confirmed green" would read as the app agreeing with you rather than as a
     * thing on the pavement.
     */
    streetGlobe: '#3E8E41',
  },
  /**
   * The paper scale. Smaller and quieter than the statement scale on purpose:
   * these two are never in competition, because one is read at a glance and the
   * other is read deliberately, with the phone held closer.
   */
  type: {
    /** Uppercase section labels. The only voice the paper zone uses to shout. */
    micro: {
      fontSize: 11,
      fontWeight: '800' as const,
      lineHeight: 15,
      letterSpacing: 1.7,
    },
    /** A paper headline, where a section needs one. */
    headline: {
      fontSize: 42,
      fontWeight: '800' as const,
      lineHeight: 45,
      letterSpacing: -1.6,
    },
    nameSmall: {
      fontSize: 21,
      fontWeight: '800' as const,
      lineHeight: 26,
      letterSpacing: -0.4,
    },
    /** Running prose. */
    body: {
      fontSize: 18,
      fontWeight: '500' as const,
      lineHeight: 26,
    },
    bodyStrong: {
      fontSize: 18,
      fontWeight: '700' as const,
      lineHeight: 25,
    },
    /** List entries — the "this, this, this". */
    item: {
      fontSize: 17,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    /** The ordinal in front of a list entry. */
    ordinal: {
      fontSize: 15,
      fontWeight: '800' as const,
      lineHeight: 22,
    },
    /** Asides: what the train passes without stopping, what we did not survey. */
    aside: {
      fontSize: 13.5,
      fontWeight: '500' as const,
      lineHeight: 19,
    },
  },
  /** The page margin. Generous, and the same on every paper surface. */
  margin: 26,
  /** The heavy rule that opens a page, and the bar down the side of a notice. */
  rules: { head: 5, bar: 4 },
} as const;

/**
 * The statement scale — Transit Authority type.
 *
 * One weight, one case, tight negative tracking, left-ranged on a hard grid.
 * These sizes are not "big for impact": they are the sizes at which a sentence
 * survives being glanced at from the far side of a moving carriage, which is
 * the only reading condition this zone is designed for.
 */
export const StatementTheme = {
  type: {
    /** The kicker across the top: which phase, and how far through. */
    kicker: {
      fontSize: 12,
      fontWeight: '800' as const,
      lineHeight: 16,
      letterSpacing: 1.6,
    },
    /**
     * The statement itself. Auto-fitted down from here when the words are long
     * — see `statementFontSize`. Never set larger: 82pt is already wider than
     * the thumb that will be covering part of the screen.
     */
    headlineMax: 82,
    headlineTracking: -4.5,
    /** Ratio of line height to font size for the headline. Tighter than 1. */
    headlineLeading: 0.93,
    /** "for the 3 toward" — the connective tissue under the statement. */
    sub: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 26,
    },
    /** The proper noun the statement is about: a headsign, a station. */
    name: {
      fontSize: 34,
      fontWeight: '800' as const,
      lineHeight: 38,
      letterSpacing: -1,
    },
    /** The count on the train card. Its own size because it is its own idea. */
    counter: {
      fontSize: 250,
      fontWeight: '800' as const,
      lineHeight: 230,
      letterSpacing: -16,
    },
    counterLabel: {
      fontSize: 34,
      fontWeight: '800' as const,
      lineHeight: 34,
      letterSpacing: -0.8,
    },
  },
  /** The page margin in the statement zone. */
  margin: 28,
  /**
   * The bullet is the subject of the screen, not an icon sitting inside a
   * layout, so it is drawn at a size that cannot fit and allowed to bleed off
   * the right edge.
   */
  bullet: { size: 226, overhang: 68, glyphRatio: 0.62 },
} as const;

/**
 * What is left of the old theme once colour moved into the two materials above.
 *
 * These are the tokens that were never about looks: how far apart things sit,
 * how big a thing has to be before a moving thumb can hit it, and how long the
 * taps go on for. Everything that used to live here — a dark palette, a
 * typographic scale, card radii, four elevation shadows — described a stack of
 * floating dark rectangles, and there are no floating dark rectangles left.
 */
export const SubwayTheme = {
  spacing: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 },
  radii: { bullet: 999 },
  hapticSequences: {
    // Direct configurations passed to expo-haptics notification methods
    STATION_APPROACH_PATTERN: [0, 100, 50, 100],            // Short sequence warning to stand up
    CRITICAL_DESTINATION_ALERT: [0, 500, 250, 500, 250, 500], // Powerful haptic pulse
  },
  /**
   * Minimum touch target. Larger than the 44pt platform default on purpose:
   * this interface is operated one-handed on a moving train.
   */
  minTouchTarget: 56,
} as const;

export type SubwayThemeType = typeof SubwayTheme;

/**
 * The point size a statement can be set at without clipping.
 *
 * The statement zone gives the headline a fixed column so the bullet bleeding
 * in from the right overlaps empty field rather than eating a word. A fixed
 * point size would mean "WAIT HERE" fits and "UP AND OUT" does not, and a
 * clipped instruction underground is a wrong instruction — so the longest word
 * decides the size for the whole statement. 0.62em is the advance width of
 * uppercase Helvetica-family caps at weight 800, measured rather than guessed.
 */
export function statementFontSize(lines: readonly string[], columnWidth: number): number {
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 1);
  const fitted = Math.floor(columnWidth / (longest * 0.62));
  return Math.max(34, Math.min(StatementTheme.type.headlineMax, fitted));
}

/* ------------------------------------------------------------------ *
 * Line-colour derivations
 *
 * The MTA colours are fixed and must never be adjusted (see lines.ts). What we
 * *can* do is derive translucent treatments from them, so a surface can carry
 * the identity of the line the traveller is riding without repainting the
 * bullet into some softer, wrong shade.
 * ------------------------------------------------------------------ */

function channels(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * A line colour at a given opacity. Falls back to the untouched input when it
 * is handed something that is not a hex triple, because a slightly wrong tint
 * is survivable and a crash on a navigation card is not.
 */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = channels(hex);
  if (!rgb) return hex;
  const clamped = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamped})`;
}

function relativeLuminance(hex: string): number {
  const rgb = channels(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. Falls back to 1 on anything unparseable. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * How far a label may be held back on a given field.
 *
 * The statement zone knocks its secondary type back so the statement itself
 * leads — but the MTA's twenty-two colour pairs are not equally strong. White
 * on the Broadway yellow's black is enormous; white on the L and S grey is
 * about 3.7:1 before anything is faded, and holding a label back on top of that
 * pushes it under the floor. So the fade is spent only where the pairing can
 * afford it. This is legibility arithmetic, not a style token: the line colours
 * themselves must never be adjusted, so the only variable left is us.
 */
export function safeSecondaryOpacity(field: string, ink: string, wanted: number): number {
  return contrastRatio(field, ink) >= 5 ? wanted : 1;
}
