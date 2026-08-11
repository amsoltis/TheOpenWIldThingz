import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineID, StopLadder } from '@streetlevel/shared';
import { LINE_COLORS, SubwayTheme, withAlpha } from '@streetlevel/shared';

import { SectionCaption } from './SectionCaption';

interface StopLadderViewProps {
  ladder: StopLadder;
  line: LineID | null;
  /** Where the alight stop is actually taking them, shown on the destination flag. */
  destinationLabel?: string | undefined;
}

/**
 * Every stop, in order, as a ladder.
 *
 * "Ride 14 stops" asks a stranger to hold a number in their head for
 * twenty-six minutes while doubting it the whole way. Nobody can do that, and
 * the failure mode is getting off early "just in case". Naming the stops turns
 * the count into a checklist: each sign that slides past the window is matched
 * against a row and struck off, and being on the right train stops being a
 * belief and becomes an observation.
 *
 * The passed-through stations matter just as much. On an express, watching four
 * lit platforms fly by is indistinguishable from missing four stops unless
 * somebody told you in advance — so they are drawn, ghosted, between the nodes,
 * and labelled as expected.
 */
export function StopLadderView({ ladder, line, destinationLabel }: StopLadderViewProps): ReactElement {
  const colour = line ? LINE_COLORS[line] : SubwayTheme.colors.textSecondary;
  const lastIndex = ladder.stops.length - 1;
  const rideLength = Math.max(ladder.alightIndex, 0);

  return (
    <View style={styles.container}>
      <SectionCaption
        label="EVERY STOP, IN ORDER"
        accent={colour}
        trailing={`${rideLength} ${rideLength === 1 ? 'STOP' : 'STOPS'}`}
      />

      <View style={styles.ladder}>
        {ladder.stops.map((stop, index) => {
          const isBoarding = index === 0;
          const isAlight = index === ladder.alightIndex;
          const isPast = index > ladder.alightIndex;
          const flyPast = ladder.passedThrough?.[String(index)] ?? [];

          return (
            <View key={`${stop}-${index}`}>
              {flyPast.length > 0 ? (
                <FlyPastGroup names={flyPast} colour={colour} />
              ) : null}

              <View style={styles.row} accessible accessibilityRole="text">
                <Text style={styles.count} allowFontScaling={false}>
                  {isBoarding ? '' : String(index)}
                </Text>

                <View style={styles.rail}>
                  {index > 0 || flyPast.length > 0 ? (
                    <View style={[styles.spineTop, { backgroundColor: colour }]} />
                  ) : null}
                  {index < lastIndex ? (
                    <View style={[styles.spineBottom, { backgroundColor: colour }]} />
                  ) : null}

                  {isAlight ? (
                    <View style={[styles.alightNode, { borderColor: colour, boxShadow: `0px 0px 0px 6px ${withAlpha(colour, 0.22)}` }]}>
                      <View style={[styles.alightCore, { backgroundColor: colour }]} />
                    </View>
                  ) : isBoarding ? (
                    <View style={[styles.boardNode, { backgroundColor: colour }]} />
                  ) : (
                    <View style={[styles.node, { borderColor: colour }]} />
                  )}
                </View>

                <View style={styles.body}>
                  <Text
                    style={[
                      isAlight ? styles.alightName : styles.stopName,
                      isPast ? styles.pastName : null,
                    ]}
                    numberOfLines={2}
                  >
                    {stop}
                  </Text>

                  {isBoarding ? (
                    <Text style={styles.boardTag} allowFontScaling={false}>
                      YOU GET ON HERE
                    </Text>
                  ) : null}

                  {isAlight ? (
                    <View style={[styles.alightFlag, { backgroundColor: colour }]}>
                      <Text style={styles.alightFlagText} allowFontScaling={false}>
                        GET OFF HERE
                      </Text>
                    </View>
                  ) : null}

                  {isAlight && destinationLabel ? (
                    <Text style={styles.alightFor}>for {destinationLabel}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

interface FlyPastGroupProps {
  names: readonly string[];
  colour: string;
}

/**
 * Drawn as a dashed rail rather than as more nodes: the visual difference has
 * to be obvious from across the carriage, because the whole point is "these are
 * not stops you are counting".
 */
function FlyPastGroup({ names, colour }: FlyPastGroupProps): ReactElement {
  return (
    <View
      style={styles.flyRow}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`The train passes ${names.join(', ')} without stopping.`}
    >
      <View style={styles.countSpacer} />
      <View style={styles.rail}>
        {[0, 1, 2].map((dash) => (
          <View key={dash} style={[styles.dash, { backgroundColor: colour }]} />
        ))}
      </View>
      <View style={styles.body}>
        <Text style={styles.flyNames}>{names.join('  ·  ')}</Text>
        <Text style={styles.flyCaption} allowFontScaling={false}>
          DOES NOT STOP HERE
        </Text>
      </View>
    </View>
  );
}

const RAIL_WIDTH = 34;
const SPINE_WIDTH = 5;

const styles = StyleSheet.create({
  container: {
    marginTop: SubwayTheme.spacing.md,
  },
  ladder: {
    marginTop: SubwayTheme.spacing.sm,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    borderRadius: SubwayTheme.radii.chip,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
    paddingVertical: SubwayTheme.spacing.md,
    paddingRight: SubwayTheme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 36,
  },
  flyRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 46,
  },
  count: {
    ...SubwayTheme.typography.numeric,
    width: 30,
    textAlign: 'right',
    color: SubwayTheme.colors.textTertiary,
    paddingTop: 11,
  },
  countSpacer: {
    width: 30,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 6,
  },
  spineTop: {
    position: 'absolute',
    top: 0,
    bottom: '50%',
    width: SPINE_WIDTH,
    left: (RAIL_WIDTH - SPINE_WIDTH) / 2,
  },
  spineBottom: {
    position: 'absolute',
    top: '50%',
    bottom: 0,
    width: SPINE_WIDTH,
    left: (RAIL_WIDTH - SPINE_WIDTH) / 2,
  },
  node: {
    width: 15,
    height: 15,
    borderRadius: SubwayTheme.radii.bullet,
    borderWidth: 4,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
  },
  boardNode: {
    width: 17,
    height: 17,
    borderRadius: SubwayTheme.radii.bullet,
    borderWidth: 3,
    borderColor: SubwayTheme.colors.textPrimary,
  },
  alightNode: {
    width: 26,
    height: 26,
    borderRadius: SubwayTheme.radii.bullet,
    borderWidth: 5,
    backgroundColor: SubwayTheme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alightCore: {
    width: 8,
    height: 8,
    borderRadius: SubwayTheme.radii.bullet,
  },
  dash: {
    width: 4,
    height: 5,
    borderRadius: 2,
    opacity: SubwayTheme.colors.ghostOpacity,
  },
  body: {
    flex: 1,
    paddingVertical: 6,
    paddingLeft: SubwayTheme.spacing.xs,
  },
  stopName: {
    ...SubwayTheme.typography.bodyStrong,
    fontSize: 17,
    color: SubwayTheme.colors.textPrimary,
  },
  pastName: {
    color: SubwayTheme.colors.textTertiary,
  },
  alightName: {
    ...SubwayTheme.typography.sectionTitle,
    color: SubwayTheme.colors.textPrimary,
  },
  boardTag: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textTertiary,
    marginTop: SubwayTheme.spacing.xxs,
  },
  alightFlag: {
    alignSelf: 'flex-start',
    borderRadius: SubwayTheme.radii.plate,
    paddingHorizontal: SubwayTheme.spacing.sm,
    paddingVertical: 5,
    marginTop: SubwayTheme.spacing.sm,
  },
  alightFlagText: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textPrimary,
  },
  alightFor: {
    ...SubwayTheme.typography.supportBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.xs,
  },
  flyNames: {
    ...SubwayTheme.typography.supportBody,
    color: SubwayTheme.colors.textTertiary,
    opacity: 0.9,
  },
  flyCaption: {
    ...SubwayTheme.typography.microLabel,
    fontSize: 10,
    color: SubwayTheme.colors.textTertiary,
    marginTop: SubwayTheme.spacing.xxs,
  },
});
