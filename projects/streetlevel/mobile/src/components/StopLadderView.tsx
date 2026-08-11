import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineID, StopLadder } from '@streetlevel/shared';
import { LINE_COLORS, LINE_TEXT_COLORS, PaperTheme } from '@streetlevel/shared';

import { PaperSection } from './PaperSection';

interface StopLadderViewProps {
  ladder: StopLadder;
  line: LineID | null;
  /** Where the alight stop is actually taking them, printed under the last row. */
  destinationLabel?: string | undefined;
}

/**
 * Every stop, in order.
 *
 * "Ride 14 stops" asks a stranger to hold a number in their head for
 * twenty-six minutes while doubting it the whole way. Nobody can do that, and
 * the failure mode is getting off early "just in case". Naming the stops turns
 * the count into a checklist: each sign that slides past the window is matched
 * against a row and struck off, and being on the right train stops being a
 * belief and becomes an observation.
 *
 * Set as a numbered list rather than as a diagram of nodes and spines. The old
 * drawing spent most of its width rendering a subway line nobody needed to see
 * — the traveller is *on* it — and squeezed the station names, which are the
 * only part that can be matched against a platform sign.
 *
 * The passed-through stations matter just as much. On an express, watching four
 * lit platforms fly by is indistinguishable from missing four stops unless
 * somebody said so in advance, so they are printed between the rows in italic
 * and explicitly labelled as expected.
 */
export function StopLadderView({ ladder, line, destinationLabel }: StopLadderViewProps): ReactElement {
  const colour = line ? LINE_COLORS[line] : PaperTheme.colors.ink;
  // The GET OFF HERE flag is a line-coloured fill, so its text has to come from
  // the MTA's own pairing rather than being assumed light. On the N, Q, R and W
  // that pairing is black, and a paper-coloured flag on Broadway yellow would
  // be the one unreadable thing on the most important row of the list.
  const flagInk = line ? LINE_TEXT_COLORS[line] : PaperTheme.colors.paper;
  const rideLength = Math.max(ladder.alightIndex, 0);

  return (
    <PaperSection
      label="EVERY STOP, IN ORDER"
      trailing={`${rideLength} ${rideLength === 1 ? 'STOP' : 'STOPS'}`}
    >
      <View>
        {ladder.stops.map((stop, index) => {
          const isBoarding = index === 0;
          const isAlight = index === ladder.alightIndex;
          const isPast = index > ladder.alightIndex;
          const flyPast = ladder.passedThrough?.[String(index)] ?? [];

          return (
            <View key={`${stop}-${index}`}>
              {flyPast.length > 0 ? (
                <View
                  style={styles.flyRow}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`The train passes ${flyPast.join(', ')} without stopping.`}
                >
                  <View style={styles.markColumn} />
                  <Text style={styles.flyText}>
                    passes {flyPast.join(', ')} without stopping
                  </Text>
                </View>
              ) : null}

              <View style={styles.row} accessible accessibilityRole="text">
                <View style={styles.markColumn}>
                  <Text
                    style={[styles.ordinal, isBoarding || isAlight ? { color: colour } : null]}
                    allowFontScaling={false}
                  >
                    {isBoarding ? '—' : String(index)}
                  </Text>
                </View>

                <View style={styles.body}>
                  <Text
                    style={[
                      styles.name,
                      isBoarding || isAlight ? styles.nameStrong : null,
                      isPast ? styles.namePast : null,
                    ]}
                    numberOfLines={2}
                  >
                    {stop}
                  </Text>

                  {isBoarding ? (
                    <Text style={styles.tag} allowFontScaling={false}>
                      YOU GET ON HERE
                    </Text>
                  ) : null}

                  {isAlight ? (
                    <View style={[styles.flag, { backgroundColor: colour }]}>
                      <Text style={[styles.flagText, { color: flagInk }]} allowFontScaling={false}>
                        GET OFF HERE
                      </Text>
                    </View>
                  ) : null}

                  {isAlight && destinationLabel ? (
                    <Text style={styles.forWhat}>for {destinationLabel}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </PaperSection>
  );
}

const MARK_WIDTH = 26;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    minHeight: 34,
  },
  flyRow: {
    flexDirection: 'row',
    minHeight: 26,
  },
  markColumn: {
    width: MARK_WIDTH,
  },
  /**
   * No spine. A drawn rail down the side of a printed list is a diagram of a
   * subway line the traveller is already sitting on — it spends width on
   * information they have, and takes it from the station names, which are the
   * only part that can be matched against a platform sign. The ordinals
   * enumerate perfectly well on their own.
   */
  ordinal: {
    ...PaperTheme.type.ordinal,
    color: PaperTheme.colors.inkMuted,
    width: MARK_WIDTH,
  },
  body: {
    flex: 1,
    paddingBottom: 12,
  },
  name: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.ink,
  },
  nameStrong: {
    fontSize: 19,
    fontWeight: '800',
  },
  namePast: {
    color: PaperTheme.colors.inkMuted,
  },
  tag: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.inkMuted,
    marginTop: 3,
  },
  flag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 7,
  },
  flagText: {
    ...PaperTheme.type.micro,
  },
  forWhat: {
    ...PaperTheme.type.aside,
    color: PaperTheme.colors.inkMuted,
    marginTop: 5,
  },
  flyText: {
    ...PaperTheme.type.aside,
    color: PaperTheme.colors.inkMuted,
    fontStyle: 'italic',
    flexShrink: 1,
  },
});
