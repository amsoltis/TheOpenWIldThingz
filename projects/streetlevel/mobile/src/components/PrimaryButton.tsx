import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { PaperTheme, SubwayTheme } from '@streetlevel/shared';

export type ButtonTone = 'primary' | 'quiet' | 'alert';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** A line colour, where the action commits to a specific train. */
  tintColor?: string;
  /** Text colour on a tinted button. Must come from `LINE_TEXT_COLORS`. */
  tintInk?: string;
}

/**
 * The one committing action on a screen, and nothing else.
 *
 * Every tappable thing still funnels through here so the 56pt minimum target is
 * a property of the component rather than a rule people remember — this
 * interface is operated one-handed, in motion, sometimes with gloves on.
 *
 * What changed is how many of these a screen is allowed to have. The card deck
 * used to end in five stacked slabs, which is what a screen looks like when
 * every capability was given a button instead of a place. The deck now moves on
 * a swipe and this component survives only where there is a genuine commitment
 * to make: build the trip, confirm the corner, find me.
 *
 * Square rather than rounded, because everything else on the page is set like
 * print and a pill would be the only object on screen pretending to be soft.
 */
export function PrimaryButton({
  label,
  onPress,
  tone = 'primary',
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  style,
  tintColor,
  tintInk,
}: PrimaryButtonProps): ReactElement {
  const solid = tone === 'primary';
  const background = solid ? (tintColor ?? PaperTheme.colors.ink) : 'transparent';
  const border =
    tone === 'alert' ? PaperTheme.colors.danger : tintColor ?? PaperTheme.colors.ink;
  const labelColour = solid
    ? (tintInk ?? PaperTheme.colors.paper)
    : tone === 'alert'
      ? PaperTheme.colors.danger
      : PaperTheme.colors.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled }}
      hitSlop={SubwayTheme.spacing.sm}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        solid ? null : { borderWidth: 2, borderColor: border },
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={[styles.label, { color: labelColour }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: SubwayTheme.minTouchTarget,
    paddingHorizontal: 22,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.3,
  },
  label: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
