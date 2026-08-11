import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SubwayTheme } from '@streetlevel/shared';

export type AlertTone = 'danger' | 'success';

interface AlertNoteProps {
  caption: string;
  text: string;
  tone?: AlertTone;
}

/**
 * The "do not walk down those stairs" plate.
 *
 * Red is spent on the frame, the bar and the caption, and the sentence itself
 * is set in white on a red wash. Long-form red-on-black is the least legible
 * thing this palette can produce, and this is the one paragraph that has to be
 * readable at a glance while walking — so the alarm is carried by the container
 * and the legibility is left to the text.
 *
 * It sits directly under the instruction on every card. An avoidance note below
 * a fold is a note nobody read.
 */
export function AlertNote({ caption, text, tone = 'danger' }: AlertNoteProps): ReactElement {
  const colour = tone === 'danger' ? SubwayTheme.colors.danger : SubwayTheme.colors.success;
  const wash = tone === 'danger' ? SubwayTheme.colors.dangerWash : SubwayTheme.colors.successWash;

  return (
    <View
      style={[styles.box, { backgroundColor: wash, borderColor: colour }]}
      accessible
      accessibilityRole="alert"
    >
      <View style={[styles.bar, { backgroundColor: colour }]} />
      <View style={styles.body}>
        <View style={styles.captionRow}>
          <View style={[styles.mark, { borderColor: colour }]}>
            <Text style={[styles.markGlyph, { color: colour }]} allowFontScaling={false}>
              {tone === 'danger' ? '!' : '✓'}
            </Text>
          </View>
          <Text style={[styles.caption, { color: colour }]} allowFontScaling={false}>
            {caption}
          </Text>
        </View>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    borderRadius: SubwayTheme.radii.chip,
    borderWidth: SubwayTheme.borders.hairline,
    overflow: 'hidden',
  },
  bar: {
    width: 5,
  },
  body: {
    flex: 1,
    paddingHorizontal: SubwayTheme.spacing.md,
    paddingVertical: 14,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SubwayTheme.spacing.xs,
  },
  mark: {
    width: 18,
    height: 18,
    borderRadius: SubwayTheme.radii.bullet,
    borderWidth: SubwayTheme.borders.emphasis,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SubwayTheme.spacing.sm,
  },
  markGlyph: {
    fontSize: 12,
    fontWeight: '900',
    includeFontPadding: false,
    textAlign: 'center',
  },
  caption: {
    ...SubwayTheme.typography.microLabel,
  },
  text: {
    ...SubwayTheme.typography.bodyStrong,
    fontSize: 16,
    lineHeight: 22,
    color: SubwayTheme.colors.textPrimary,
  },
});
