import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { SubwayTheme, withAlpha } from '@streetlevel/shared';

/**
 * The green glass globe on a post that marks an always-open staircase.
 *
 * It is the only object on a New York pavement that means "subway entrance" and
 * nothing else, which makes it worth more to a tourist than any amount of prose
 * — you can find it from across a junction, at night, without reading English.
 * Drawn only where the surveyor's cue actually names one.
 */
export function StreetGlobe(): ReactElement {
  return (
    <View style={styles.holder} accessibilityElementsHidden>
      <View style={styles.glow} />
      <View style={styles.globe}>
        <View style={styles.highlight} />
      </View>
      <View style={styles.collar} />
      <View style={styles.post} />
      <View style={styles.base} />
    </View>
  );
}

const styles = StyleSheet.create({
  holder: {
    width: 44,
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    top: 0,
    width: 40,
    height: 40,
    borderRadius: SubwayTheme.radii.bullet,
    backgroundColor: withAlpha(SubwayTheme.colors.streetGlobe, 0.28),
  },
  globe: {
    width: 26,
    height: 26,
    borderRadius: SubwayTheme.radii.bullet,
    backgroundColor: SubwayTheme.colors.streetGlobe,
    marginTop: 7,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 4,
    left: 5,
    width: 9,
    height: 7,
    borderRadius: SubwayTheme.radii.bullet,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  collar: {
    width: 12,
    height: 4,
    borderRadius: 1,
    backgroundColor: SubwayTheme.colors.textTertiary,
  },
  post: {
    width: 5,
    height: 16,
    backgroundColor: SubwayTheme.colors.textTertiary,
  },
  base: {
    width: 18,
    height: 4,
    borderRadius: 2,
    backgroundColor: SubwayTheme.colors.textTertiary,
  },
});
