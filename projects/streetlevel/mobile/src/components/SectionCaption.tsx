import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SubwayTheme } from '@streetlevel/shared';

interface SectionCaptionProps {
  label: string;
  /** Line colour, when the section belongs to a specific train. */
  accent?: string | undefined;
  trailing?: string | undefined;
}

/**
 * A caption with a rule running off to the edge of the card.
 *
 * Station signage divides itself with rules rather than boxes, and the habit is
 * worth borrowing: a rule separates without adding another rectangle to a
 * screen that is already a stack of rectangles, so the eye lands on the content
 * under the caption instead of counting containers.
 */
export function SectionCaption({ label, accent, trailing }: SectionCaptionProps): ReactElement {
  return (
    <View style={styles.row}>
      <View style={[styles.tick, accent ? { backgroundColor: accent } : null]} />
      <Text style={styles.label} allowFontScaling={false}>
        {label}
      </Text>
      <View style={styles.rule} />
      {trailing ? (
        <Text style={styles.trailing} allowFontScaling={false}>
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tick: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: SubwayTheme.colors.textTertiary,
    marginRight: SubwayTheme.spacing.sm,
  },
  label: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textSecondary,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: SubwayTheme.colors.hairline,
    marginLeft: SubwayTheme.spacing.sm,
  },
  trailing: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textTertiary,
    marginLeft: SubwayTheme.spacing.sm,
  },
});
