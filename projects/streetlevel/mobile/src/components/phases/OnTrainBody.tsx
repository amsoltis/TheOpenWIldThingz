import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineID, RouteCard } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { AlertNote } from '../AlertNote';
import { LookForList } from '../LookForList';
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
 * becomes a checklist they hold against the window: the ladder is the hero and
 * the wrong-direction check sits under it as the one thing that could still
 * have gone wrong at the moment the doors closed.
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
          <AlertNote caption="IF THAT IS NOT WHAT YOU SEE" text={card.criticalAvoidanceNotes} />
        </View>
      ) : null}

      <LookForList anchors={card.visualAnchors} accent={accent} label="CHECK YOU GOT ON THE RIGHT ONE" />

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
    marginTop: SubwayTheme.spacing.md,
  },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SubwayTheme.spacing.md,
    padding: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.chip,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
  },
  sensorCount: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    color: SubwayTheme.colors.textPrimary,
    marginRight: SubwayTheme.spacing.md,
    includeFontPadding: false,
  },
  sensorText: {
    ...SubwayTheme.typography.supportBody,
    color: SubwayTheme.colors.textSecondary,
    flexShrink: 1,
  },
});
