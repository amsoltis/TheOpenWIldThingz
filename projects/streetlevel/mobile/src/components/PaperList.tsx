import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaperTheme } from '@streetlevel/shared';

export interface PaperListRow {
  /** Body text of the entry. */
  text: string;
  /** A quieter line underneath: what the train passes, what we did not survey. */
  aside?: string | undefined;
  /** Overrides the ordinal. Used by the stop ladder for "you are here". */
  mark?: string | undefined;
  /** Sets the row in full ink at a larger size — the row that is about you. */
  emphasis?: boolean;
}

interface PaperListProps {
  rows: readonly PaperListRow[];
  /** Numbered by default. Dashes where the items have no order to them. */
  ordered?: boolean;
  /** Accent for the marks — the line's colour, where the list belongs to a train. */
  accent?: string | undefined;
  /** Rendered after the last row, inside the list's indent. */
  footer?: ReactNode;
}

/**
 * The enumeration. This, this, this.
 *
 * The product's whole promise underground is that there is nothing to work out
 * — every remaining thing is a short list of things to look at, and each one
 * either matches the world or it does not. Set as prose, that list becomes a
 * paragraph to parse; set as rows against a hanging ordinal, it becomes a
 * checklist that can be ticked off against a wall while walking.
 */
export function PaperList({ rows, ordered = true, accent, footer }: PaperListProps): ReactElement | null {
  if (rows.length === 0) return null;

  return (
    <View>
      {rows.map((row, index) => (
        <View key={`${row.text}-${index}`} style={styles.row} accessible accessibilityRole="text">
          <Text
            style={[styles.mark, accent && row.emphasis ? { color: accent } : null]}
            allowFontScaling={false}
          >
            {row.mark ?? (ordered ? String(index + 1) : '—')}
          </Text>
          <View style={styles.body}>
            <Text style={row.emphasis ? styles.textEmphasis : styles.text}>{row.text}</Text>
            {row.aside ? <Text style={styles.aside}>{row.aside}</Text> : null}
          </View>
        </View>
      ))}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const MARK_WIDTH = 26;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  mark: {
    ...PaperTheme.type.ordinal,
    width: MARK_WIDTH,
    color: PaperTheme.colors.inkMuted,
  },
  body: {
    flex: 1,
    paddingRight: 4,
  },
  text: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.ink,
  },
  textEmphasis: {
    ...PaperTheme.type.item,
    fontSize: 19,
    fontWeight: '800',
    color: PaperTheme.colors.ink,
  },
  aside: {
    ...PaperTheme.type.aside,
    color: PaperTheme.colors.inkMuted,
    fontStyle: 'italic',
    marginTop: 3,
  },
  footer: {
    marginLeft: MARK_WIDTH,
  },
});
