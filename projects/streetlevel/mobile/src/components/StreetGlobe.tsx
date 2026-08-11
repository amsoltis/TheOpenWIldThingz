import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { PaperTheme, withAlpha } from '@streetlevel/shared';

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
    width: 40,
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    top: 0,
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: withAlpha(PaperTheme.colors.streetGlobe, 0.22),
  },
  globe: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: PaperTheme.colors.streetGlobe,
    marginTop: 6,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 4,
    left: 5,
    width: 9,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  collar: {
    width: 12,
    height: 4,
    backgroundColor: PaperTheme.colors.ink,
  },
  post: {
    width: 5,
    height: 16,
    backgroundColor: PaperTheme.colors.ink,
  },
  base: {
    width: 18,
    height: 4,
    backgroundColor: PaperTheme.colors.ink,
  },
});
