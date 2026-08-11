import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineID } from '@streetlevel/shared';
import { PaperTheme } from '@streetlevel/shared';

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
 *
 * Sitting on paper it finally looks like what it is. A black plate on a warm
 * page is how every station map ever printed drew this; against the old dark
 * card it was a slightly different black on black and needed a border to exist
 * at all.
 */
export function DirectionalSign({ lines, legends, banner }: DirectionalSignProps): ReactElement {
  const spoken =
    `Overhead sign: ${lines.join(' ')} ${legends.join(', ')}`.replace(/\s+/g, ' ').trim();

  return (
    <View>
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
                <LineBullet line={line} size={58} />
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
  plate: {
    backgroundColor: PaperTheme.colors.plate,
    overflow: 'hidden',
  },
  banner: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerText: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.plateInk,
    opacity: 0.72,
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  bullets: {
    flexDirection: 'row',
  },
  bulletSlot: {
    marginRight: 4,
  },
  legends: {
    flex: 1,
    marginLeft: 16,
  },
  legendPrimary: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
    color: PaperTheme.colors.plateInk,
  },
  legendSecondary: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    color: PaperTheme.colors.plateInk,
    opacity: 0.75,
    marginTop: 2,
  },
  arrow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  arrowShaft: {
    width: 16,
    height: 7,
    backgroundColor: PaperTheme.colors.plateInk,
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 13,
    borderBottomWidth: 13,
    borderLeftWidth: 17,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: PaperTheme.colors.plateInk,
  },
  disclaimer: {
    ...PaperTheme.type.aside,
    color: PaperTheme.colors.inkMuted,
    marginTop: 12,
  },
});
