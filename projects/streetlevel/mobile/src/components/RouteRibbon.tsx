import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LINE_COLORS, SubwayTheme, withAlpha } from '@streetlevel/shared';

import { LineBullet } from './LineBullet';
import type { SpineSegment } from '../lib/journey';
import { segmentWeight } from '../lib/journey';

interface RouteRibbonProps {
  segments: readonly SpineSegment[];
  currentIndex: number;
  totalCards: number;
}

/**
 * The whole journey, always on screen.
 *
 * The deck is deliberately one card at a time, and the cost of that is losing
 * the shape of the trip: a traveller six minutes into a transfer has no way to
 * tell whether the hard part is behind them or ahead. This ribbon is the
 * answer — walk, train, transfer, train, walk — in the colours of the lines
 * they will actually be riding, with the part already done filled in and a
 * marker under where they stand now.
 *
 * It is drawn from the cards themselves, so it can never disagree with the
 * deck it sits above.
 */
export function RouteRibbon({ segments, currentIndex, totalCards }: RouteRibbonProps): ReactElement | null {
  if (segments.length === 0) return null;

  const active = segments.findIndex((s) => currentIndex >= s.from && currentIndex <= s.to);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={ribbonLabel(segments, active, currentIndex, totalCards)}
      accessibilityValue={{ min: 1, max: Math.max(totalCards, 1), now: currentIndex + 1 }}
    >
      <View style={styles.track}>
        <EndCap kind="origin" done={currentIndex > 0} />

        {segments.map((segment, index) => {
          const previous = segments[index - 1];
          const isTransfer =
            index > 0 && segment.kind === 'ride' && previous?.kind === 'ride';
          const state = index < active ? 'done' : index === active ? 'here' : 'ahead';

          return (
            <Segment
              key={`${segment.kind}-${segment.from}`}
              segment={segment}
              state={state}
              showTransfer={isTransfer}
              positionRatio={
                index === active
                  ? (currentIndex - segment.from + 0.5) / (segment.to - segment.from + 1)
                  : null
              }
            />
          );
        })}

        <EndCap kind="destination" done={currentIndex >= totalCards - 1} />
      </View>
    </View>
  );
}

interface SegmentProps {
  segment: SpineSegment;
  state: 'done' | 'here' | 'ahead';
  showTransfer: boolean;
  positionRatio: number | null;
}

function Segment({ segment, state, showTransfer, positionRatio }: SegmentProps): ReactElement {
  const colour = segment.line ? LINE_COLORS[segment.line] : SubwayTheme.colors.textTertiary;
  // Everything still to come is held back rather than hidden. The traveller is
  // allowed to see how much is left; they should not read it as "now".
  const opacity = state === 'ahead' ? 0.34 : 1;

  return (
    <>
      {showTransfer ? <TransferNode done={state !== 'ahead'} /> : null}
      <View style={[styles.segment, { flex: segmentWeight(segment) }]}>
        {segment.kind === 'ride' ? (
          <View style={[styles.bar, { backgroundColor: colour, opacity }]} />
        ) : (
          <View style={styles.walkBar}>
            {[0, 1, 2, 3, 4, 5].map((dot) => (
              <View key={dot} style={[styles.walkDot, { opacity }]} />
            ))}
          </View>
        )}

        {segment.line ? (
          <View style={[styles.bulletHolder, { opacity }]}>
            <LineBullet line={segment.line} size={26} />
          </View>
        ) : null}

        {positionRatio !== null ? (
          <View
            style={[styles.here, { left: `${Math.min(Math.max(positionRatio, 0), 1) * 100}%` }]}
          >
            <View style={styles.hereCaret} />
          </View>
        ) : null}
      </View>
    </>
  );
}

/** The white ring the map uses for a transfer: two lines, one platform change. */
function TransferNode({ done }: { done: boolean }): ReactElement {
  return <View style={[styles.transfer, done ? null : { opacity: 0.34 }]} />;
}

function EndCap({ kind, done }: { kind: 'origin' | 'destination'; done: boolean }): ReactElement {
  return (
    <View
      style={[
        styles.endCap,
        kind === 'destination' ? styles.endCapDestination : null,
        done ? styles.endCapDone : null,
      ]}
    />
  );
}

function ribbonLabel(
  segments: readonly SpineSegment[],
  active: number,
  currentIndex: number,
  totalCards: number,
): string {
  const here = segments[active];
  const where =
    here?.kind === 'ride' && here.line
      ? `on the ${here.line} train`
      : here?.kind === 'walk'
        ? 'walking'
        : 'in the station';
  const rides = segments.filter((s) => s.kind === 'ride').length;
  return `Step ${Math.min(currentIndex + 1, totalCards)} of ${totalCards}, ${where}. This trip uses ${rides} ${
    rides === 1 ? 'train' : 'trains'
  }.`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    borderRadius: SubwayTheme.radii.chip,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
    paddingHorizontal: SubwayTheme.spacing.md,
    paddingTop: SubwayTheme.spacing.sm,
    paddingBottom: SubwayTheme.spacing.sm,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  segment: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 9,
    borderRadius: 5,
  },
  walkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  walkDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: SubwayTheme.colors.textTertiary,
  },
  bulletHolder: {
    borderWidth: 3,
    borderColor: SubwayTheme.colors.surfaceSunken,
    borderRadius: SubwayTheme.radii.bullet,
  },
  transfer: {
    width: 15,
    height: 15,
    borderRadius: SubwayTheme.radii.bullet,
    borderWidth: 3,
    borderColor: SubwayTheme.colors.textPrimary,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    marginHorizontal: 3,
  },
  // Origin is a square kerb stone, destination a ring: the two ends of a trip
  // are different kinds of place and the map says so before the eye reads it.
  endCap: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: SubwayTheme.colors.textTertiary,
  },
  endCapDestination: {
    width: 13,
    height: 13,
    borderRadius: SubwayTheme.radii.bullet,
    borderWidth: 3,
    borderColor: SubwayTheme.colors.textTertiary,
    backgroundColor: 'transparent',
  },
  endCapDone: {
    backgroundColor: SubwayTheme.colors.textPrimary,
    borderColor: SubwayTheme.colors.textPrimary,
  },
  here: {
    position: 'absolute',
    bottom: -6,
    marginLeft: -9,
    width: 18,
    alignItems: 'center',
  },
  hereCaret: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: SubwayTheme.colors.textPrimary,
    boxShadow: `0px 0px 10px ${withAlpha('#FFFFFF', 0.55)}`,
  },
});
