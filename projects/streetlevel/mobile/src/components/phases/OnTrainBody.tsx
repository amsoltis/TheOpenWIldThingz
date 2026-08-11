import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineID, RouteCard } from '@streetlevel/shared';
import { PaperTheme } from '@streetlevel/shared';

import { PaperList } from '../PaperList';
import { PaperNotice } from '../PaperNotice';
import { PaperSection } from '../PaperSection';
import { StopLadderView } from '../StopLadderView';

interface OnTrainBodyProps {
  card: RouteCard;
  line: LineID | null;
  accent: string | undefined;
  destinationLabel?: string | undefined;
}

/**
 * Sitting on a moving train with no signal.
 *
 * Nothing here is an action. The traveller's whole job for the next twenty
 * minutes is to not get off too early and not get off too late, so the card
 * becomes a printed list they hold against the window — every stop, in order,
 * ticked off as its sign slides past. This is the phase the paper zone was
 * chosen for: it is the longest read in the product and the one that most
 * rewards being set like a page rather than like an app.
 */
export function OnTrainBody({ card, line, accent, destinationLabel }: OnTrainBodyProps): ReactElement {
  return (
    <View>
      {card.stopLadder ? (
        <StopLadderView ladder={card.stopLadder} line={line} destinationLabel={destinationLabel} />
      ) : null}

      {/* The card shell normally floats this above the instruction. Here it
          would push all fourteen stops off the screen to warn about the first
          one — and the first one is right there at the top of the ladder the
          traveller is already reading. */}
      {card.criticalAvoidanceNotes ? (
        <View style={styles.avoidance}>
          <PaperNotice caption="IF THAT IS NOT WHAT YOU SEE" text={card.criticalAvoidanceNotes} />
        </View>
      ) : null}

      {card.visualAnchors.length > 0 ? (
        <PaperSection label="CHECK YOU GOT ON THE RIGHT ONE">
          <PaperList rows={card.visualAnchors.map((text) => ({ text }))} accent={accent} />
        </PaperSection>
      ) : null}

      {/* Restated as a countdown under the ladder rather than above it: the
          named stops are the reassurance, this is the arithmetic behind them. */}
      {card.offlineSensorValidation ? (
        <View style={styles.sensorRow}>
          <Text style={styles.sensorCount} allowFontScaling={false}>
            {card.offlineSensorValidation.expectedTunnelTransitCount}
          </Text>
          <Text style={styles.sensorText}>
            stop
            {card.offlineSensorValidation.expectedTunnelTransitCount === 1 ? '' : 's'} to go. The stop
            after this one is {card.offlineSensorValidation.expectedNextStationNodeName}.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avoidance: {
    marginTop: 22,
  },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: PaperTheme.colors.rule,
  },
  sensorCount: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -2,
    color: PaperTheme.colors.ink,
    marginRight: 16,
    includeFontPadding: false,
  },
  sensorText: {
    ...PaperTheme.type.aside,
    fontSize: 15,
    lineHeight: 21,
    color: PaperTheme.colors.inkMuted,
    flexShrink: 1,
  },
});
