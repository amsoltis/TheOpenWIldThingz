import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { SubwayTheme } from '@streetlevel/shared';

interface PhaseProgressProps {
  total: number;
  currentIndex: number;
  accentColor?: string;
}

/**
 * Segments rather than a percentage bar. "Step 4 of 7" is a countable promise —
 * the traveller can see the end of the underground portion coming, which is the
 * single most reassuring thing this interface can offer while they are down
 * there with no signal and no daylight.
 */
export function PhaseProgress({ total, currentIndex, accentColor }: PhaseProgressProps): ReactElement {
  const accent = accentColor ?? SubwayTheme.colors.textPrimary;
  const segments = Array.from({ length: Math.max(total, 0) }, (_, i) => i);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${Math.min(currentIndex + 1, total)} of ${total}`}
      accessibilityValue={{ min: 1, max: Math.max(total, 1), now: currentIndex + 1 }}
    >
      {segments.map((index) => (
        <View
          key={index}
          style={[
            styles.segment,
            index <= currentIndex
              ? { backgroundColor: accent }
              : { backgroundColor: accent, opacity: SubwayTheme.colors.dimmedOpacity },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
});
