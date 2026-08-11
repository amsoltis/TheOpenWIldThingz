import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineID } from '@streetlevel/shared';
import { LINE_COLORS, SubwayTheme, withAlpha } from '@streetlevel/shared';

import { LineBullet } from './LineBullet';
import { VerticalFade } from './VerticalFade';

interface StationPlateProps {
  name: string;
  linesServed: readonly LineID[];
  /** Line the traveller is actually here for. Tints the plate; the rest stay plain. */
  accentLine?: LineID | null;
  eyebrow?: string;
  /** Demoted caveat. Present, never leading. */
  note?: string | undefined;
  size?: 'hero' | 'inline';
}

/**
 * Station identity, stated with confidence.
 *
 * A traveller standing on a pavement in a city they cannot read needs one thing
 * from this screen: certainty about which station they are looking for. So the
 * name is large, the bullets are the size they are on the physical sign, and
 * anything we are unsure about — an unsurveyed staircase, an exit we have not
 * walked — is set below a rule in small type. The caveat is still there and
 * still honest; it simply is not the first thing a nervous person reads.
 */
export function StationPlate({
  name,
  linesServed,
  accentLine,
  eyebrow,
  note,
  size = 'hero',
}: StationPlateProps): ReactElement {
  const hero = size === 'hero';
  const accent = accentLine ? LINE_COLORS[accentLine] : SubwayTheme.colors.textSecondary;
  const bulletSize = hero ? 46 : 38;

  return (
    <View
      style={[styles.plate, { borderColor: withAlpha(accent, 0.4) }]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={
        linesServed.length > 0
          ? `${name} station, served by the ${linesServed.join(', ')} trains.`
          : `${name} station.`
      }
    >
      {/* Only the full-screen plate carries its own wash. Nested inside a route
          card the line colour is already washed across the card head, and
          stacking the two turns the plate into a muddy card-within-a-card. */}
      {hero ? <VerticalFade color={accent} height={150} anchor="top" maxAlpha={0.16} /> : null}
      <View style={[styles.cap, { backgroundColor: accent }]} />

      <View style={hero ? styles.body : styles.bodyInline}>
        {eyebrow ? (
          <Text style={styles.eyebrow} allowFontScaling={false}>
            {eyebrow}
          </Text>
        ) : null}

        {linesServed.length > 0 ? (
          <View style={styles.bullets}>
            {linesServed.map((line) => (
              <View key={line} style={styles.bulletSlot}>
                <LineBullet line={line} size={bulletSize} />
              </View>
            ))}
          </View>
        ) : null}

        <Text style={hero ? styles.nameHero : styles.nameInline} numberOfLines={3}>
          {name}
        </Text>

        {note ? (
          <View style={styles.noteBlock}>
            <Text style={styles.note}>{note}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    borderRadius: SubwayTheme.radii.card,
    borderWidth: SubwayTheme.borders.hairline,
    backgroundColor: SubwayTheme.colors.surfaceRaised,
    overflow: 'hidden',
    boxShadow: SubwayTheme.elevation.raised,
  },
  cap: {
    height: 6,
  },
  body: {
    padding: SubwayTheme.spacing.lg,
  },
  bodyInline: {
    padding: SubwayTheme.spacing.md,
  },
  eyebrow: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textSecondary,
    marginBottom: SubwayTheme.spacing.sm,
  },
  bullets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SubwayTheme.spacing.sm,
  },
  bulletSlot: {
    marginRight: SubwayTheme.spacing.sm,
    marginBottom: SubwayTheme.spacing.xs,
  },
  nameHero: {
    ...SubwayTheme.typography.stationName,
    color: SubwayTheme.colors.textPrimary,
  },
  nameInline: {
    ...SubwayTheme.typography.sectionTitle,
    color: SubwayTheme.colors.textPrimary,
  },
  noteBlock: {
    marginTop: SubwayTheme.spacing.md,
    paddingTop: SubwayTheme.spacing.md,
    borderTopWidth: SubwayTheme.borders.hairline,
    borderTopColor: SubwayTheme.colors.hairline,
  },
  note: {
    ...SubwayTheme.typography.supportBody,
    color: SubwayTheme.colors.textTertiary,
  },
});
