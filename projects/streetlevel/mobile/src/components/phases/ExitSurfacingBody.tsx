import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RouteCard } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { LookForList } from '../LookForList';
import { SectionCaption } from '../SectionCaption';

interface ExitSurfacingBodyProps {
  card: RouteCard;
  accent: string | undefined;
  destinationLabel?: string | undefined;
}

/**
 * Coming back up.
 *
 * The instinct at this point is to relax, and it is the wrong moment for it:
 * two exits from one station can put you a long block apart, facing the wrong
 * way, at the end of a trip you thought was over. The EXIT plate is the hero
 * above the instruction; what is left down here is the part people forget —
 * that surfacing is not arriving, and there is still a walk. Drawing the walk
 * as a path from a staircase to a pin is what stops someone stepping onto the
 * pavement and assuming they are done.
 */
export function ExitSurfacingBody({
  card,
  accent,
  destinationLabel,
}: ExitSurfacingBodyProps): ReactElement {
  return (
    <View>
      {destinationLabel ? (
        <View style={styles.section}>
          <SectionCaption label="THEN THE WALK" accent={accent} />
          <View style={styles.walkRow}>
            <Staircase />
            <View style={styles.walkPath} accessibilityElementsHidden>
              {[0, 1, 2, 3, 4].map((dot) => (
                <View key={dot} style={styles.walkDot} />
              ))}
            </View>
            <View style={styles.walkTarget}>
              <View style={styles.pin} />
              <Text style={styles.walkLabel} numberOfLines={2}>
                {destinationLabel}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <LookForList anchors={card.visualAnchors} accent={accent} label="AT THE TOP OF THE STAIRS" />
    </View>
  );
}

/** Four rising treads. Reads as "up and out" faster than the word does. */
function Staircase(): ReactElement {
  return (
    <View style={styles.stairs} accessibilityElementsHidden>
      {[9, 15, 21, 27].map((height) => (
        <View key={height} style={[styles.tread, { height }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: SubwayTheme.spacing.md,
  },
  walkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SubwayTheme.spacing.sm,
    padding: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.chip,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
  },
  stairs: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  tread: {
    width: 6,
    marginRight: 2,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: SubwayTheme.colors.textSecondary,
  },
  walkPath: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SubwayTheme.spacing.sm,
  },
  walkDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: SubwayTheme.colors.textTertiary,
    marginRight: 5,
  },
  walkTarget: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pin: {
    width: 13,
    height: 13,
    borderRadius: SubwayTheme.radii.bullet,
    borderWidth: 4,
    borderColor: SubwayTheme.colors.textPrimary,
    marginRight: SubwayTheme.spacing.sm,
  },
  walkLabel: {
    ...SubwayTheme.typography.bodyStrong,
    fontSize: 16,
    color: SubwayTheme.colors.textPrimary,
    flexShrink: 1,
  },
});
