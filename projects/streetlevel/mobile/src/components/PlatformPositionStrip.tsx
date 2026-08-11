import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineFocusConfig } from '@streetlevel/shared';
import { LINE_COLORS, SubwayTheme } from '@streetlevel/shared';

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
 */
export function PlatformPositionStrip({ focus }: PlatformPositionStripProps): ReactElement {
  const target = clampCarIndex(focus.expectedTrainCarIndex);
  const lineColor = LINE_COLORS[focus.activeLineId];

  return (
    <View style={styles.container}>
      <Text style={styles.caption}>WHERE TO STAND</Text>

      <View
        style={styles.train}
        accessible
        accessibilityRole="image"
        accessibilityLabel={carAccessibilityLabel(focus.expectedTrainCarIndex)}
      >
        <Text style={styles.endLabel} allowFontScaling={false}>
          FRONT
        </Text>
        {carSlots().map((car) => {
          const isTarget = car === target;
          return (
            <View
              key={car}
              style={[
                styles.car,
                isTarget
                  ? { backgroundColor: lineColor, borderColor: SubwayTheme.colors.textPrimary }
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
          );
        })}
        <Text style={styles.endLabel} allowFontScaling={false}>
          BACK
        </Text>
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
    marginTop: SubwayTheme.spacing.lg,
  },
  caption: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
    marginBottom: SubwayTheme.spacing.sm,
  },
  train: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  car: {
    flex: 1,
    height: 40,
    marginHorizontal: 1,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherCar: {
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderColor: SubwayTheme.colors.surfaceCard,
  },
  carLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  targetCarLabel: {
    color: SubwayTheme.colors.textPrimary,
  },
  otherCarLabel: {
    color: SubwayTheme.colors.textSecondary,
  },
  endLabel: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
    marginHorizontal: SubwayTheme.spacing.xs,
  },
  zoneText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textPrimary,
    marginTop: SubwayTheme.spacing.md,
  },
  positioningText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.xs,
  },
});
