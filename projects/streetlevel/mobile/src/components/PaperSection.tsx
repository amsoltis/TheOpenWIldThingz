import type { ReactNode, ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaperTheme } from '@streetlevel/shared';

interface PaperSectionProps {
  label: string;
  /** Sits at the right end of the label line — a count, a duration. */
  trailing?: string | undefined;
  /** Suppresses the rule above, for the first section on a page. */
  flush?: boolean;
  children: ReactNode;
}

/**
 * A section of the enumeration: a hairline, a quiet uppercase label, content.
 *
 * Printed matter divides itself with rules, not with boxes. Every recessed
 * well and rounded card this replaced was another rectangle for the eye to
 * count on a screen that was already a stack of rectangles — and each one cost
 * contrast, because a surface on a surface has to be a different lightness from
 * the thing under it. A rule costs nothing and separates just as hard.
 */
export function PaperSection({ label, trailing, flush, children }: PaperSectionProps): ReactElement {
  return (
    <View style={flush ? styles.flush : styles.section}>
      {flush ? null : <View style={styles.rule} />}
      <View style={styles.labelRow}>
        <Text style={styles.label} allowFontScaling={false}>
          {label}
        </Text>
        {trailing ? (
          <Text style={[styles.label, styles.trailing]} allowFontScaling={false}>
            {trailing}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A bare hairline, for places that divide without announcing a new section. */
export function PaperRule(): ReactElement {
  return <View style={styles.rule} />;
}

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
  flush: {
    marginTop: 0,
  },
  rule: {
    height: 1,
    backgroundColor: PaperTheme.colors.rule,
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  label: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.inkMuted,
  },
  trailing: {
    marginLeft: 12,
  },
});
