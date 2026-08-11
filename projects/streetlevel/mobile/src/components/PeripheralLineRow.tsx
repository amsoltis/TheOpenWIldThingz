import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineFocusConfig } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { LineBullet } from './LineBullet';
import { peripheralReassuranceText, targetLineReassuranceText } from '../lib/lineCopy';

interface PeripheralLineRowProps {
  focus: LineFocusConfig;
}

/**
 * Contextual Peripheral Dimming.
 *
 * The co-located lines are drawn at 25% opacity and explicitly named, never
 * removed. A traveller standing on a shared platform will watch three trains
 * they must not board pull in; an interface that shows only their line makes
 * every one of those arrivals a moment of doubt ("is the app wrong, or am I on
 * the wrong platform?"). Naming the intruders and telling them to let them pass
 * converts each arrival into a confirmation instead of a scare.
 */
export function PeripheralLineRow({ focus }: PeripheralLineRowProps): ReactElement {
  const dimmed = focus.coLocatedLinesToDim;
  const reassurance = peripheralReassuranceText(dimmed);

  return (
    <View style={styles.container}>
      <View style={styles.bulletRow}>
        <LineBullet line={focus.activeLineId} size={56} />
        {dimmed.map((line) => (
          <View key={line} style={styles.dimmedSlot}>
            <LineBullet line={line} size={44} dimmed />
          </View>
        ))}
      </View>

      <Text style={styles.activeText}>{targetLineReassuranceText(focus.activeLineId)}</Text>

      {reassurance.length > 0 ? (
        <Text style={styles.reassuranceText} accessibilityRole="text">
          {reassurance}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SubwayTheme.spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dimmedSlot: {
    marginLeft: SubwayTheme.spacing.sm,
  },
  activeText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textPrimary,
    marginTop: SubwayTheme.spacing.md,
  },
  reassuranceText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.sm,
  },
});
