import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineID } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { LineBullet } from './LineBullet';

interface DirectionalSignProps {
  lines: readonly LineID[];
  /** What the plate names: a headsign, a surveyed ceiling marker, a platform. */
  legends: readonly string[];
  /** Shown across the top of the plate, the way a real sign carries a service name. */
  banner?: string | undefined;
}

/**
 * An MTA overhead sign, drawn.
 *
 * A mezzanine is not a place where you read instructions; it is a place where
 * you walk with your head tilted back hunting a black plate with white letters
 * on it. Rendering the thing they are hunting — same black, same weight, same
 * bullets inline, same arrow — means the match happens in peripheral vision
 * before any reading takes place. A paragraph describing the sign asks them to
 * translate, and translating is the slow, anxious step we are removing.
 */
export function DirectionalSign({ lines, legends, banner }: DirectionalSignProps): ReactElement {
  const spoken =
    `Overhead sign: ${lines.join(' ')} ${legends.join(', ')}`.replace(/\s+/g, ' ').trim();

  return (
    <View style={styles.wrapper}>
      <View style={styles.plate} accessible accessibilityRole="image" accessibilityLabel={spoken}>
        {banner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText} allowFontScaling={false} numberOfLines={1}>
              {banner}
            </Text>
          </View>
        ) : null}

        <View style={styles.face}>
          <View style={styles.bullets}>
            {lines.map((line) => (
              <View key={line} style={styles.bulletSlot}>
                <LineBullet line={line} size={62} />
              </View>
            ))}
          </View>

          <View style={styles.legends}>
            {legends.length > 0 ? (
              legends.map((legend, index) => (
                <Text
                  key={`${legend}-${index}`}
                  style={index === 0 ? styles.legendPrimary : styles.legendSecondary}
                  numberOfLines={2}
                >
                  {legend}
                </Text>
              ))
            ) : (
              <Text style={styles.legendPrimary} numberOfLines={2}>
                Follow this bullet
              </Text>
            )}
          </View>

          <SignArrow />
        </View>
      </View>

      {/* The arrow on the drawn plate is vernacular, not instruction. We know
          which sign to hunt for; we have not surveyed which way it points. */}
      <Text style={styles.disclaimer}>
        The real plate carries an arrow. Go whichever way that one points.
      </Text>
    </View>
  );
}

/**
 * Shaft plus a solid triangle head, built from a zero-size view with
 * transparent side borders — the same trick the web uses, and the only way to
 * get a real arrowhead without adding a drawing library.
 */
function SignArrow(): ReactElement {
  return (
    <View style={styles.arrow} accessibilityElementsHidden>
      <View style={styles.arrowShaft} />
      <View style={styles.arrowHead} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: SubwayTheme.spacing.md,
  },
  plate: {
    backgroundColor: SubwayTheme.colors.signPlate,
    borderRadius: SubwayTheme.radii.plate,
    borderWidth: SubwayTheme.borders.emphasis,
    borderColor: SubwayTheme.colors.hairlineStrong,
    overflow: 'hidden',
    boxShadow: SubwayTheme.elevation.card,
  },
  banner: {
    borderBottomWidth: SubwayTheme.borders.hairline,
    borderBottomColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: SubwayTheme.spacing.md,
    paddingVertical: SubwayTheme.spacing.sm,
  },
  bannerText: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.signInk,
    opacity: 0.72,
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SubwayTheme.spacing.md,
    paddingVertical: SubwayTheme.spacing.lg,
  },
  bullets: {
    flexDirection: 'row',
  },
  bulletSlot: {
    marginRight: SubwayTheme.spacing.xs,
  },
  legends: {
    flex: 1,
    marginLeft: SubwayTheme.spacing.md,
  },
  legendPrimary: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
    color: SubwayTheme.colors.signInk,
  },
  legendSecondary: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    color: SubwayTheme.colors.signInk,
    opacity: 0.75,
    marginTop: SubwayTheme.spacing.xxs,
  },
  arrow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SubwayTheme.spacing.md,
  },
  arrowShaft: {
    width: 18,
    height: 7,
    backgroundColor: SubwayTheme.colors.signInk,
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 13,
    borderBottomWidth: 13,
    borderLeftWidth: 17,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
    borderLeftColor: SubwayTheme.colors.signInk,
  },
  disclaimer: {
    ...SubwayTheme.typography.supportBody,
    color: SubwayTheme.colors.textTertiary,
    marginTop: SubwayTheme.spacing.sm,
  },
});
