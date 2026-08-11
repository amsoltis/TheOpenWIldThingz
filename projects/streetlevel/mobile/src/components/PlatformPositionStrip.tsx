import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineFocusConfig } from '@streetlevel/shared';
import { LINE_COLORS, LINE_TEXT_COLORS, PaperTheme } from '@streetlevel/shared';

import { PaperSection } from './PaperSection';
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
 * On paper this is drawn the way a printed platform plan is drawn: outlined
 * cars, one filled. The target car is the only colour in the picture and it
 * carries a marker above it, which is what turns the diagram into an
 * instruction you can obey by walking.
 */
export function PlatformPositionStrip({ focus }: PlatformPositionStripProps): ReactElement {
  const target = clampCarIndex(focus.expectedTrainCarIndex);
  const lineColor = LINE_COLORS[focus.activeLineId];
  const carInk = LINE_TEXT_COLORS[focus.activeLineId];

  return (
    <PaperSection label="WHERE TO STAND ON THE PLATFORM">
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
                style={[styles.car, isTarget ? { backgroundColor: lineColor, borderColor: lineColor } : null]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.carLabel, { color: isTarget ? carInk : PaperTheme.colors.inkMuted }]}
                >
                  {car}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* The platform edge, hatched. Drawn in ink rather than its real yellow:
          a yellow band next to line bullets reads as the N/Q/R/W. */}
      <View style={styles.platformEdge} accessibilityElementsHidden>
        {Array.from({ length: 26 }, (_, i) => (
          <View key={i} style={styles.edgeHatch} />
        ))}
      </View>

      <Text style={styles.zoneText}>
        Car {target} of {TRAIN_CAR_COUNT} — {carZoneText(target)}.
      </Text>
      <Text style={styles.positioningText}>{focus.platformPositioningText}</Text>
    </PaperSection>
  );
}

const styles = StyleSheet.create({
  endLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  endLabel: {
    ...PaperTheme.type.micro,
    fontSize: 9,
    color: PaperTheme.colors.inkMuted,
  },
  train: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  carSlot: {
    flex: 1,
    marginRight: 2,
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
    height: 34,
    borderWidth: 1.5,
    borderColor: PaperTheme.colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  platformEdge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  edgeHatch: {
    width: 6,
    height: 3,
    backgroundColor: PaperTheme.colors.ruleStrong,
    transform: [{ skewX: '-30deg' }],
  },
  zoneText: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.ink,
    marginTop: 18,
  },
  positioningText: {
    ...PaperTheme.type.aside,
    fontSize: 15,
    lineHeight: 21,
    color: PaperTheme.colors.inkMuted,
    marginTop: 5,
  },
});
