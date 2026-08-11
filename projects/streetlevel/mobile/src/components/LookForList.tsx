import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SubwayTheme } from '@streetlevel/shared';

import { SectionCaption } from './SectionCaption';

interface LookForListProps {
  anchors: readonly string[];
  accent?: string | undefined;
  label?: string;
}

/**
 * The visual anchors, set as a checklist in a recessed well.
 *
 * These are the things the traveller is supposed to physically find, so they
 * are given a surface of their own to be scanned against — the eye goes to the
 * well, matches a line to the world, and comes back. As loose paragraphs under
 * a caption they read as small print, which is the opposite of their job.
 */
export function LookForList({ anchors, accent, label = 'LOOK FOR' }: LookForListProps): ReactElement | null {
  if (anchors.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionCaption label={label} accent={accent} />
      <View style={styles.well}>
        {anchors.map((anchor, index) => (
          <View
            key={`${anchor}-${index}`}
            style={[styles.row, index > 0 ? styles.rowDivided : null]}
          >
            <View
              style={[styles.marker, accent ? { backgroundColor: accent } : null]}
              accessibilityElementsHidden
            />
            <Text style={styles.text}>{anchor}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SubwayTheme.spacing.md,
  },
  well: {
    marginTop: SubwayTheme.spacing.sm,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    borderRadius: SubwayTheme.radii.chip,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
    paddingHorizontal: SubwayTheme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SubwayTheme.spacing.md,
  },
  rowDivided: {
    borderTopWidth: SubwayTheme.borders.hairline,
    borderTopColor: SubwayTheme.colors.hairline,
  },
  marker: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: SubwayTheme.colors.textTertiary,
    marginRight: SubwayTheme.spacing.md,
    marginTop: 8,
  },
  text: {
    ...SubwayTheme.typography.supportBody,
    fontSize: 16,
    lineHeight: 23,
    color: SubwayTheme.colors.textPrimary,
    flexShrink: 1,
  },
});
