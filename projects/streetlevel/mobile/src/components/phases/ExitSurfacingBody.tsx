import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RouteCard } from '@streetlevel/shared';
import { PaperTheme } from '@streetlevel/shared';

import { PaperList } from '../PaperList';
import { PaperSection } from '../PaperSection';

interface ExitSurfacingBodyProps {
  card: RouteCard;
  destinationLabel?: string | undefined;
}

/**
 * Coming back up.
 *
 * The instinct at this point is to relax, and it is the wrong moment for it:
 * two exits from one station can put you a long block apart, facing the wrong
 * way, at the end of a trip you thought was over. So the part people forget
 * gets drawn — that surfacing is not arriving, and there is still a walk.
 * Drawing it as a path from a staircase to a pin is what stops someone stepping
 * onto the pavement and assuming they are done.
 */
export function ExitSurfacingBody({ card, destinationLabel }: ExitSurfacingBodyProps): ReactElement {
  return (
    <View>
      {destinationLabel ? (
        <PaperSection label="THEN THE WALK">
          <View style={styles.walkRow}>
            <Staircase />
            <View style={styles.path} accessibilityElementsHidden>
              {[0, 1, 2, 3, 4, 5].map((dot) => (
                <View key={dot} style={styles.dot} />
              ))}
            </View>
            <View style={styles.target}>
              <View style={styles.pin} />
              <Text style={styles.targetLabel} numberOfLines={2}>
                {destinationLabel}
              </Text>
            </View>
          </View>
        </PaperSection>
      ) : null}

      {card.visualAnchors.length > 0 ? (
        <PaperSection label="AT THE TOP OF THE STAIRS">
          <PaperList rows={card.visualAnchors.map((text) => ({ text }))} />
        </PaperSection>
      ) : null}
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
  walkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stairs: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  /** Butted together, not spaced: separated bars read as a chart, not stairs. */
  tread: {
    width: 8,
    backgroundColor: PaperTheme.colors.ink,
  },
  path: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PaperTheme.colors.ruleStrong,
    marginRight: 6,
  },
  target: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 4,
    borderColor: PaperTheme.colors.ink,
    marginRight: 10,
  },
  targetLabel: {
    ...PaperTheme.type.item,
    fontWeight: '800',
    color: PaperTheme.colors.ink,
    flexShrink: 1,
  },
});
