import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineFocusConfig } from '@streetlevel/shared';
import { PaperTheme } from '@streetlevel/shared';

import { LineBullet } from './LineBullet';
import { PaperSection } from './PaperSection';
import { peripheralReassuranceText, targetLineReassuranceText } from '../lib/lineCopy';

interface PeripheralLineRowProps {
  focus: LineFocusConfig;
}

/**
 * Contextual Peripheral Dimming.
 *
 * The co-located lines are explicitly named, never removed. A traveller
 * standing on a shared platform will watch three trains they must not board
 * pull in; an interface that shows only their line makes every one of those
 * arrivals a moment of doubt ("is the app wrong, or am I on the wrong
 * platform?"). Naming the intruders and telling them to let them pass converts
 * each arrival into a confirmation instead.
 *
 * The suppression is now entirely scale and hierarchy: a 72pt bullet under
 * BOARD ONLY THIS ONE, and 34pt bullets under a rule that says NOT YOURS.
 * Fading them was a dark-screen trick, and a faded bullet on warm paper is a
 * pastel smudge — unidentifiable, which is the one thing a peripheral bullet
 * must never be, since naming the train you are letting go is its entire job.
 */
export function PeripheralLineRow({ focus }: PeripheralLineRowProps): ReactElement {
  const dimmed = focus.coLocatedLinesToDim;
  const reassurance = peripheralReassuranceText(dimmed, focus.activeLineId);

  return (
    <View>
      <PaperSection label="BOARD ONLY THIS ONE">
        <View style={styles.activeRow}>
          <LineBullet line={focus.activeLineId} size={72} />
          <Text style={styles.activeSentence}>
            {targetLineReassuranceText(focus.activeLineId, dimmed)}
          </Text>
        </View>
      </PaperSection>

      {dimmed.length > 0 ? (
        <PaperSection label="ALSO STOPS HERE — NOT YOURS">
          <View style={styles.dimmedRow}>
            {dimmed.map((line) => (
              <View key={line} style={styles.dimmedSlot}>
                <LineBullet line={line} size={34} dimmed />
              </View>
            ))}
          </View>
          {reassurance.length > 0 ? <Text style={styles.reassurance}>{reassurance}</Text> : null}
        </PaperSection>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeSentence: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.ink,
    flexShrink: 1,
    marginLeft: 18,
  },
  dimmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dimmedSlot: {
    marginRight: 10,
  },
  reassurance: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.inkMuted,
    marginTop: 14,
  },
});
