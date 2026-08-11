/**
 * Design tokens for a screen that will be read one-handed, at arm's length, in
 * a dark tunnel, by someone who is already anxious. Every value here is a
 * legibility decision, not a taste decision.
 */
export const SubwayTheme = {
  colors: {
    backgroundDark: '#121212',       // Prevents harsh screen glare inside dark tunnels
    surfaceCard: '#1E1E1E',          // High-contrast container layer
    textPrimary: '#FFFFFF',          // Bold visibility labels
    textSecondary: '#A0A0A0',        // Supporting metadata
    dimmedOpacity: 0.25,             // 75% visual suppression for peripheral noise line items
    activeFocusOpacity: 1.0,         // Crisp focus configuration
    danger: '#FF453A',               // Avoidance notes and the wrong-direction warning
    success: '#30D158',              // Confirmation that they are in the right place
    scrim: 'rgba(0,0,0,0.72)',       // Behind the entrance-lock gate
  },
  typography: {
    macroActionTitle: {
      fontSize: 32,
      fontWeight: '800' as const,
      lineHeight: 40,
      letterSpacing: -0.5,
    },
    landmarkBody: {
      fontSize: 18,
      fontWeight: '500' as const,
      lineHeight: 26,
    },
    metaLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      lineHeight: 18,
      letterSpacing: 0.8,
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radii: { card: 20, bullet: 999, button: 14 },
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
