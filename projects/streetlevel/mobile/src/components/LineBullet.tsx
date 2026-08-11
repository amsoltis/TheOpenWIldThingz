import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineID } from '@streetlevel/shared';
import { LINE_COLORS, LINE_TEXT_COLORS, SubwayTheme } from '@streetlevel/shared';

import { lineAccessibilityLabel } from '../lib/lineCopy';

interface LineBulletProps {
  line: LineID;
  size?: number;
  dimmed?: boolean;
}

/**
 * The colours are the MTA's own, straight from the shared package, and are
 * never adjusted for contrast or taste. The entire point is that the circle on
 * this screen is the same circle hanging from the ceiling above the traveller's
 * head — a "nicer" orange is a different train.
 */
export function LineBullet({ line, size = 48, dimmed = false }: LineBulletProps): ReactElement {
  const diameter = size;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={lineAccessibilityLabel(line, dimmed)}
      style={[
        styles.bullet,
        {
          width: diameter,
          height: diameter,
          borderRadius: SubwayTheme.radii.bullet,
          backgroundColor: LINE_COLORS[line],
          opacity: dimmed ? SubwayTheme.colors.dimmedOpacity : SubwayTheme.colors.activeFocusOpacity,
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[
          styles.label,
          { color: LINE_TEXT_COLORS[line], fontSize: Math.round(diameter * 0.55) },
        ]}
      >
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bullet: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
