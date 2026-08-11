import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineFocusConfig } from '@streetlevel/shared';
import { LINE_COLORS, SubwayTheme, withAlpha } from '@streetlevel/shared';

import { LineBullet } from './LineBullet';
import { VerticalFade } from './VerticalFade';
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
 *
 * The scale gap is doing the same work as the opacity gap. Their bullet is
 * drawn at the size it hangs at on the platform and lit by a halo of its own
 * colour; the others are small, flat and pushed below a rule. The right answer
 * should be findable without reading a word of it.
 */
export function PeripheralLineRow({ focus }: PeripheralLineRowProps): ReactElement {
  const dimmed = focus.coLocatedLinesToDim;
  const reassurance = peripheralReassuranceText(dimmed, focus.activeLineId);
  const colour = LINE_COLORS[focus.activeLineId];

  return (
    <View style={[styles.container, { borderColor: withAlpha(colour, 0.35) }]}>
      <VerticalFade color={colour} height={126} anchor="top" maxAlpha={0.2} />

      <View style={styles.activeRow}>
        <View style={[styles.halo, { backgroundColor: withAlpha(colour, 0.22) }]}>
          <LineBullet line={focus.activeLineId} size={72} />
        </View>
        <View style={styles.activeText}>
          <Text style={styles.activeCaption} allowFontScaling={false}>
            BOARD ONLY THIS ONE
          </Text>
          <Text style={styles.activeSentence}>{targetLineReassuranceText(focus.activeLineId, dimmed)}</Text>
        </View>
      </View>

      {dimmed.length > 0 ? (
        <View style={styles.dimmedBlock}>
          <View style={styles.dimmedRow}>
            <Text style={styles.dimmedCaption} allowFontScaling={false}>
              ALSO STOPS HERE{'\n'}NOT YOURS
            </Text>
            {dimmed.map((line) => (
              <View key={line} style={styles.dimmedSlot}>
                <LineBullet line={line} size={38} dimmed />
              </View>
            ))}
          </View>
          {reassurance.length > 0 ? (
            <Text style={styles.reassuranceText} accessibilityRole="text">
              {reassurance}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.card,
    borderWidth: SubwayTheme.borders.hairline,
    backgroundColor: SubwayTheme.colors.surfaceRaised,
    overflow: 'hidden',
    boxShadow: SubwayTheme.elevation.raised,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SubwayTheme.spacing.md,
  },
  halo: {
    padding: SubwayTheme.spacing.sm,
    borderRadius: SubwayTheme.radii.bullet,
  },
  activeText: {
    flex: 1,
    marginLeft: SubwayTheme.spacing.md,
  },
  activeCaption: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textSecondary,
    marginBottom: SubwayTheme.spacing.xs,
  },
  activeSentence: {
    ...SubwayTheme.typography.bodyStrong,
    color: SubwayTheme.colors.textPrimary,
  },
  dimmedBlock: {
    borderTopWidth: SubwayTheme.borders.hairline,
    borderTopColor: SubwayTheme.colors.hairline,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    padding: SubwayTheme.spacing.md,
  },
  dimmedCaption: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textTertiary,
    flex: 1,
    marginRight: SubwayTheme.spacing.sm,
  },
  dimmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dimmedSlot: {
    marginLeft: SubwayTheme.spacing.sm,
  },
  reassuranceText: {
    ...SubwayTheme.typography.supportBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.md,
  },
});
