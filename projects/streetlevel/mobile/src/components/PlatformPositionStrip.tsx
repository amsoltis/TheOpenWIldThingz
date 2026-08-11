import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineFocusConfig } from '@streetlevel/shared';
import { LINE_COLORS, SubwayTheme, withAlpha } from '@streetlevel/shared';

import { SectionCaption } from './SectionCaption';
import {
  TRAIN_CAR_COUNT,
  carAccessibilityLabel,
  carSlots,
  carZoneText,
  clampCarIndex,
} from '../lib/platformGeometry';

interface PlatformPositionStripProps {
  focus: LineFocusConfig;
}

/**
 * Standing in the right car is the difference between surfacing at the exit you
 * were promised and walking the length of a platform in the wrong direction
 * with a suitcase. The strip is a plan view of the train with the front marked,
 * because "car 3" means nothing to someone who has never seen the train yet.
 *
 * The train is drawn sunk into a trough with the platform edge hatched below
 * it, so it reads as a train seen from above at a platform rather than as ten
 * abstract boxes. The target car is the only lit thing in the picture and it
 * carries a marker above it, which is what turns the diagram into an
 * instruction you can obey by walking.
 */
export function PlatformPositionStrip({ focus }: PlatformPositionStripProps): ReactElement {
  const target = clampCarIndex(focus.expectedTrainCarIndex);
  const lineColor = LINE_COLORS[focus.activeLineId];

  return (
    <View style={styles.container}>
      <SectionCaption label="WHERE TO STAND ON THE PLATFORM" accent={lineColor} />

      <View style={styles.trough}>
        <View style={styles.endLabels}>
          <Text style={styles.endLabel} allowFontScaling={false}>
            FRONT OF TRAIN
          </Text>
          <Text style={styles.endLabel} allowFontScaling={false}>
            BACK
          </Text>
        </View>

        <View
          style={styles.train}
          accessible
          accessibilityRole="image"
          accessibilityLabel={carAccessibilityLabel(focus.expectedTrainCarIndex)}
        >
          {carSlots().map((car) => {
            const isTarget = car === target;
            return (
              <View key={car} style={styles.carSlot}>
                {isTarget ? (
                  <View style={[styles.marker, { borderTopColor: lineColor }]} />
                ) : (
                  <View style={styles.markerSpacer} />
                )}
                <View
                  style={[
                    styles.car,
                    isTarget
                      ? {
                          backgroundColor: lineColor,
                          borderColor: SubwayTheme.colors.textPrimary,
                          boxShadow: `0px 0px 14px ${withAlpha(lineColor, 0.65)}`,
                        }
                      : styles.otherCar,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[styles.carLabel, isTarget ? styles.targetCarLabel : styles.otherCarLabel]}
                  >
                    {car}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* The platform edge, hatched. Drawn in grey rather than its real
            yellow: a yellow band next to line bullets reads as the N/Q/R/W. */}
        <View style={styles.platformEdge} accessibilityElementsHidden>
          {Array.from({ length: 26 }, (_, i) => (
            <View key={i} style={styles.edgeHatch} />
          ))}
        </View>
      </View>

      <Text style={styles.zoneText}>
        Car {target} of {TRAIN_CAR_COUNT} — {carZoneText(target)}.
      </Text>
      <Text style={styles.positioningText}>{focus.platformPositioningText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SubwayTheme.spacing.md,
  },
  trough: {
    marginTop: SubwayTheme.spacing.sm,
    backgroundColor: SubwayTheme.colors.surfaceInset,
    borderRadius: SubwayTheme.radii.chip,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
    paddingHorizontal: SubwayTheme.spacing.sm,
    paddingTop: SubwayTheme.spacing.sm,
    overflow: 'hidden',
  },
  endLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SubwayTheme.spacing.xs,
    marginBottom: SubwayTheme.spacing.xs,
  },
  endLabel: {
    ...SubwayTheme.typography.microLabel,
    fontSize: 9,
    color: SubwayTheme.colors.textTertiary,
  },
  train: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  carSlot: {
    flex: 1,
    marginHorizontal: 1,
    alignItems: 'center',
  },
  marker: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: 3,
  },
  markerSpacer: {
    height: 9,
  },
  car: {
    alignSelf: 'stretch',
    height: 38,
    borderRadius: 4,
    borderWidth: SubwayTheme.borders.emphasis,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherCar: {
    backgroundColor: SubwayTheme.colors.surfaceRaised,
    borderColor: SubwayTheme.colors.hairline,
  },
  carLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  targetCarLabel: {
    color: SubwayTheme.colors.textPrimary,
  },
  otherCarLabel: {
    color: SubwayTheme.colors.textTertiary,
  },
  platformEdge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SubwayTheme.spacing.sm,
    paddingBottom: SubwayTheme.spacing.sm,
  },
  edgeHatch: {
    width: 6,
    height: 3,
    borderRadius: 1,
    backgroundColor: SubwayTheme.colors.textTertiary,
    opacity: 0.5,
    transform: [{ skewX: '-30deg' }],
  },
  zoneText: {
    ...SubwayTheme.typography.bodyStrong,
    color: SubwayTheme.colors.textPrimary,
    marginTop: SubwayTheme.spacing.md,
  },
  positioningText: {
    ...SubwayTheme.typography.supportBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.xs,
  },
});
