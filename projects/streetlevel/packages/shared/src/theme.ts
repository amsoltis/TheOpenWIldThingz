/**
 * Design tokens for a screen that will be read one-handed, at arm's length, in
 * a dark tunnel, by someone who is already anxious. Every value here is a
 * legibility decision, not a taste decision.
 */
export const SubwayTheme = {
  colors: {
    backgroundDark: '#121212',       // Prevents harsh screen glare inside dark tunnels
    // One step darker than the card, used behind the deck. Depth here is not
    // decoration: a card that visibly floats above its background is read as
    // "the thing to act on now", which is the entire premise of the deck.
    backgroundDeep: '#0A0A0B',
    surfaceCard: '#1E1E1E',          // High-contrast container layer
    surfaceRaised: '#272729',        // Sits on top of a card — sign plates, ladders, strips
    surfaceSunken: '#151517',        // Recessed wells inside a card
    surfaceInset: '#0D0D0E',         // Deepest well: the platform trough, the ladder gutter
    hairline: 'rgba(255,255,255,0.08)',       // Separation without drawing a line the eye stops on
    hairlineStrong: 'rgba(255,255,255,0.18)',
    textPrimary: '#FFFFFF',          // Bold visibility labels
    textSecondary: '#A0A0A0',        // Supporting metadata
    textTertiary: '#6E6E75',         // Ghosted: stations flying past, spent credits
    // The MTA's own sign vernacular. Black plate, white Helvetica. A traveller
    // hunting the ceiling for a sign recognises this before they read it, so it
    // is a colour pair rather than a style choice.
    signPlate: '#0B0B0B',
    signInk: '#FFFFFF',
    // The green glass globe over an always-open staircase. Street furniture,
    // not a line and not a status, so it is deliberately its own token rather
    // than borrowed from `success` — a globe tinted "confirmed green" would be
    // read as the app agreeing with you rather than as a thing on the pavement.
    streetGlobe: '#3E8E41',
    dimmedOpacity: 0.25,             // 75% visual suppression for peripheral noise line items
    ghostOpacity: 0.42,              // Present but explicitly not yours — passed-through stops
    activeFocusOpacity: 1.0,         // Crisp focus configuration
    danger: '#FF453A',               // Avoidance notes and the wrong-direction warning
    dangerWash: 'rgba(255,69,58,0.13)',
    success: '#30D158',              // Confirmation that they are in the right place
    successWash: 'rgba(48,209,88,0.13)',
    scrim: 'rgba(0,0,0,0.72)',       // Behind the entrance-lock gate
  },
  /**
   * A real scale rather than "whatever font size looked right". Sizes step by
   * roughly a fourth so two adjacent levels are never mistakable for each other
   * at arm's length on a moving train — hierarchy has to survive vibration.
   */
  typography: {
    display: {
      fontSize: 44,
      fontWeight: '900' as const,
      lineHeight: 46,
      letterSpacing: -1.4,
    },
    macroActionTitle: {
      fontSize: 32,
      fontWeight: '800' as const,
      lineHeight: 40,
      letterSpacing: -0.5,
    },
    /**
     * The instruction on a route card. Smaller than the screen-owning
     * `macroActionTitle` because a card has to hold the instruction *and* the
     * thing the instruction is about — a headline that pushes the stop ladder
     * or the sign plate below the fold has won an argument it should have lost.
     */
    cardInstruction: {
      fontSize: 25,
      fontWeight: '800' as const,
      lineHeight: 31,
      letterSpacing: -0.4,
    },
    stationName: {
      fontSize: 27,
      fontWeight: '800' as const,
      lineHeight: 32,
      letterSpacing: -0.5,
    },
    sectionTitle: {
      fontSize: 21,
      fontWeight: '800' as const,
      lineHeight: 27,
      letterSpacing: -0.2,
    },
    landmarkBody: {
      fontSize: 18,
      fontWeight: '500' as const,
      lineHeight: 26,
    },
    bodyStrong: {
      fontSize: 18,
      fontWeight: '700' as const,
      lineHeight: 25,
    },
    supportBody: {
      fontSize: 15,
      fontWeight: '500' as const,
      lineHeight: 21,
    },
    metaLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      lineHeight: 18,
      letterSpacing: 0.8,
    },
    microLabel: {
      fontSize: 11,
      fontWeight: '800' as const,
      lineHeight: 14,
      letterSpacing: 1.2,
    },
    /** Counters — stop numbers, car numbers — that must read as data, not prose. */
    numeric: {
      fontSize: 14,
      fontWeight: '800' as const,
      lineHeight: 16,
      letterSpacing: 0.4,
    },
  },
  spacing: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 },
  radii: { card: 20, bullet: 999, button: 14, chip: 10, plate: 6, sheet: 28 },
  borders: { hairline: 1, emphasis: 2, plate: 3 },
  /**
   * Shadows as `boxShadow` strings so one token works on both the native and
   * the web renderer. Depth is used sparingly and always to answer the same
   * question — which layer is the traveller supposed to act on right now.
   */
  elevation: {
    card: '0px 18px 38px rgba(0,0,0,0.55)',
    raised: '0px 6px 18px rgba(0,0,0,0.45)',
    plate: '0px 3px 0px rgba(0,0,0,0.65)',
    sunken: 'inset 0px 2px 6px rgba(0,0,0,0.5)',
  },
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

/* ------------------------------------------------------------------ *
 * Line-colour accents
 *
 * The MTA colours are fixed and must never be adjusted (see lines.ts). What we
 * *can* do is derive translucent treatments from them, so a card can carry the
 * identity of the line the traveller is riding without repainting the bullet
 * into some softer, wrong shade.
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

/** The tinted header wash on an active card: enough to name the line, never enough to read as a surface of its own. */
export function lineWash(hex: string): string {
  return withAlpha(hex, 0.16);
}

/** The edge glow that lifts the active card off the deck in the line's own colour. */
export function lineGlow(hex: string): string {
  return `0px 14px 34px ${withAlpha(hex, 0.22)}`;
}
