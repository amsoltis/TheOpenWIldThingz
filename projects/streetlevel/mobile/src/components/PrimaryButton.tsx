import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SubwayTheme } from '@streetlevel/shared';

export type ButtonTone = 'primary' | 'secondary' | 'danger' | 'quiet';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  tintColor?: string;
}

/**
 * Every tappable thing in the app funnels through here so the 56pt minimum
 * target is a property of the component rather than a rule people remember.
 * The target is larger than the platform default because this interface is
 * operated one-handed, in motion, sometimes with gloves on.
 */
export function PrimaryButton({
  label,
  onPress,
  tone = 'primary',
  accessibilityHint,
  disabled = false,
  style,
  tintColor,
}: PrimaryButtonProps): ReactElement {
  const background =
    tintColor ??
    (tone === 'primary'
      ? SubwayTheme.colors.success
      : tone === 'danger'
        ? SubwayTheme.colors.danger
        : SubwayTheme.colors.surfaceCard);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled }}
      hitSlop={SubwayTheme.spacing.sm}
      style={({ pressed }) => [
        styles.button,
        tone === 'quiet' ? styles.quiet : { backgroundColor: background },
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === 'primary' ? styles.onLight : styles.onDark,
          tone === 'quiet' ? styles.quietLabel : null,
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: SubwayTheme.minTouchTarget,
    borderRadius: SubwayTheme.radii.button,
    paddingHorizontal: SubwayTheme.spacing.lg,
    paddingVertical: SubwayTheme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quiet: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: SubwayTheme.colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: SubwayTheme.colors.dimmedOpacity,
  },
  label: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  onLight: {
    color: SubwayTheme.colors.backgroundDark,
  },
  onDark: {
    color: SubwayTheme.colors.textPrimary,
  },
  quietLabel: {
    color: SubwayTheme.colors.textSecondary,
  },
});
