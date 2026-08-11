import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

interface SegmentedRailProps {
  index: number;
  total: number;
  /** Drawn in the ink of whatever surface it sits on — line ink, or paper ink. */
  color: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Progress, as a row of segments rather than as a stack of buttons.
 *
 * This is what replaced Back / Next / I Messed Up / two leg tabs at the foot of
 * every card. Those five slabs answered a question nobody was asking — the deck
 * moves on a swipe — while burying the one thing a traveller genuinely wants at
 * a glance underground: how much of this is left. Five marks answer that
 * without asking to be pressed.
 *
 * Capped at twelve segments because past that they stop being countable and
 * start being a texture, and a texture is not a progress indicator.
 */
export function SegmentedRail({ index, total, color, style }: SegmentedRailProps): ReactElement {
  const count = Math.max(Math.min(total, 12), 1);
  const scaled = total > count ? Math.round(((index + 1) / total) * count) - 1 : index;

  return (
    <View
      style={[styles.rail, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${Math.min(index + 1, total)} of ${total}.`}
      accessibilityValue={{ min: 1, max: Math.max(total, 1), now: Math.min(index + 1, total) }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[styles.segment, { backgroundColor: color, opacity: i <= scaled ? 1 : 0.3 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    height: 4,
    marginRight: 5,
  },
});
