import { Platform, StatusBar } from 'react-native';

/**
 * Fixed insets rather than react-native-safe-area-context.
 *
 * The product deliberately ships no extra native libraries, and the layouts
 * here are single-column with generous padding, so the only thing an inset must
 * guarantee is that nothing hides under the status bar or the home indicator.
 * These values do that on every current phone; a notch a few points deeper only
 * costs a few points of padding, not a hidden control.
 */
export const TOP_INSET = Platform.select({
  ios: 52,
  android: StatusBar.currentHeight ?? 24,
  default: 0,
});

export const BOTTOM_INSET = Platform.select({
  ios: 28,
  android: 12,
  default: 0,
});

/**
 * Where a statement zone starts its type.
 *
 * The colour runs to the top of the display — that is the whole point of it —
 * so the zone owns the status-bar clearance rather than being pushed down by a
 * padded root. The floor of 50 is the composition talking rather than the
 * hardware: the kicker needs air above it even on a phone with no notch.
 */
export const STATEMENT_TOP = Math.max((TOP_INSET ?? 0) + 10, 50);

/** Top padding for the paper screens, which have no colour to bleed. */
export const PAPER_TOP = (TOP_INSET ?? 0) + 26;
