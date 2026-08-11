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
