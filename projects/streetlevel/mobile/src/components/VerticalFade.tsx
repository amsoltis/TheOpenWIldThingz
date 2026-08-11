import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { withAlpha } from '@streetlevel/shared';

interface VerticalFadeProps {
  /** Hex colour to fade. Alpha is applied here, so pass the solid colour. */
  color: string;
  height: number;
  /** Which edge is opaque. The other end reaches zero. */
  anchor: 'top' | 'bottom';
  maxAlpha?: number;
  steps?: number;
}

/**
 * A gradient, built out of stacked bands.
 *
 * There is no gradient primitive in React Native and this product does not get
 * to add a drawing library for one. Ten bands of falling alpha are
 * indistinguishable from a real ramp at phone density, and they buy the two
 * things a flat interface cannot fake: a line-coloured wash that dies away
 * instead of ending in a hard edge across a sentence, and a bottom fade that
 * tells the traveller there is more card below without printing "scroll".
 */
export function VerticalFade({
  color,
  height,
  anchor,
  maxAlpha = 1,
  steps = 12,
}: VerticalFadeProps): ReactElement {
  const bandHeight = height / steps;

  return (
    <View
      style={[styles.holder, anchor === 'top' ? { top: 0 } : { bottom: 0 }, { height }]}
      accessibilityElementsHidden
      pointerEvents="none"
    >
      {Array.from({ length: steps }, (_, index) => {
        // Squared falloff: a linear ramp reads as a visible band edge at the
        // opaque end, where the eye is most able to see one.
        const t = anchor === 'top' ? index / steps : (steps - 1 - index) / steps;
        const alpha = maxAlpha * (1 - t) * (1 - t);
        return (
          <View
            key={index}
            style={{ height: bandHeight, backgroundColor: withAlpha(color, alpha) }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  holder: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
