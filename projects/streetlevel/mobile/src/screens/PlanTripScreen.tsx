import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PacketRequest, UserBillingProfile } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { PrimaryButton } from '../components/PrimaryButton';
import { resolveTripWindow } from '../lib/clock';

interface PlanTripScreenProps {
  billing: UserBillingProfile | null;
  isBusy: boolean;
  errorMessage: string | null;
  savedTripLabel: string | null;
  onSubmit: (request: PacketRequest) => void;
  onOpenSavedTrip: () => void;
  onDismissError: () => void;
}

function creditsSentence(billing: UserBillingProfile | null): string {
  if (!billing) return 'Your first trips are free.';
  if (billing.isPremiumUnlocked) return 'Lifetime access unlocked. Plan as many trips as you like.';
  if (billing.creditsRemaining <= 0) return 'No free navigation keys left.';
  if (billing.creditsRemaining === 1) return '1 free navigation key left.';
  return `${billing.creditsRemaining} free navigation keys left.`;
}

export function PlanTripScreen({
  billing,
  isBusy,
  errorMessage,
  savedTripLabel,
  onSubmit,
  onOpenSavedTrip,
  onDismissError,
}: PlanTripScreenProps): ReactElement {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departText, setDepartText] = useState('');
  const [returnText, setReturnText] = useState('');

  const window = useMemo(() => resolveTripWindow(departText, returnText), [departText, returnText]);

  const missing: string[] = [];
  if (origin.trim().length === 0) missing.push('where you are starting from');
  if (destination.trim().length === 0) missing.push('where you are going');
  if (!window) missing.push('both times, like 09:30 and 18:00');

  const canSubmit = missing.length === 0 && !isBusy;

  const submit = (): void => {
    if (!window || !canSubmit) return;
    onSubmit({
      originAddress: origin.trim(),
      destinationAddress: destination.trim(),
      departAt: window.departAt,
      returnAt: window.returnAt,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Where are you going today?</Text>
        <Text style={styles.subtitle}>
          We compile the whole trip now — both directions — so it works underground with no signal.
        </Text>

        <Field
          label="STARTING FROM"
          placeholder="Hotel name or street address"
          value={origin}
          onChange={setOrigin}
          autoFocus
        />
        <Field
          label="GOING TO"
          placeholder="The Morgan Library, 225 Madison Ave…"
          value={destination}
          onChange={setDestination}
        />

        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Field
              label="LEAVING AT"
              placeholder="09:30"
              value={departText}
              onChange={setDepartText}
              keyboard="numbers-and-punctuation"
            />
          </View>
          <View style={styles.timeSpacer} />
          <View style={styles.timeField}>
            <Field
              label="HEADING BACK"
              placeholder="18:00"
              value={returnText}
              onChange={setReturnText}
              keyboard="numbers-and-punctuation"
            />
          </View>
        </View>

        {/* The return time is not a nicety: late-night service is a different
            network, and the return leg is checked against its own alert window. */}
        <Text style={styles.hint}>
          We ask for your return time because the subway at 1am is not the subway at 1pm. Your way
          home is planned against the service that will actually be running.
        </Text>

        {errorMessage ? (
          <Pressable
            onPress={onDismissError}
            accessibilityRole="button"
            accessibilityLabel={`Error: ${errorMessage}. Tap to dismiss.`}
            style={styles.errorBox}
          >
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Text style={styles.errorDismiss}>Tap to dismiss</Text>
          </Pressable>
        ) : null}

        <PrimaryButton
          label={isBusy ? 'Compiling your trip…' : 'Build my trip'}
          onPress={submit}
          disabled={!canSubmit}
          accessibilityHint={
            missing.length > 0 ? `Still needed: ${missing.join(', ')}.` : 'Compiles both legs for offline use.'
          }
          style={styles.submit}
        />

        <Text style={styles.credits} accessibilityRole="text">
          {creditsSentence(billing)}
        </Text>

        {savedTripLabel ? (
          <PrimaryButton
            label={`Open my saved trip: ${savedTripLabel}`}
            onPress={onOpenSavedTrip}
            tone="quiet"
            accessibilityHint="Already downloaded. Works with no signal and costs nothing."
            style={styles.saved}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
  keyboard?: 'default' | 'numbers-and-punctuation';
}

function Field({ label, placeholder, value, onChange, autoFocus, keyboard }: FieldProps): ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={SubwayTheme.colors.textSecondary}
        style={styles.input}
        accessibilityLabel={label}
        autoCorrect={false}
        autoCapitalize="words"
        autoFocus={autoFocus ?? false}
        keyboardType={keyboard === 'numbers-and-punctuation' ? 'numbers-and-punctuation' : 'default'}
        returnKeyType="next"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SubwayTheme.colors.backgroundDark,
  },
  content: {
    padding: SubwayTheme.spacing.lg,
    paddingBottom: SubwayTheme.spacing.xxl,
  },
  title: {
    ...SubwayTheme.typography.macroActionTitle,
    color: SubwayTheme.colors.textPrimary,
    marginTop: SubwayTheme.spacing.lg,
  },
  subtitle: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.sm,
    marginBottom: SubwayTheme.spacing.lg,
  },
  field: {
    marginBottom: SubwayTheme.spacing.lg,
  },
  fieldLabel: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
    marginBottom: SubwayTheme.spacing.sm,
  },
  input: {
    minHeight: SubwayTheme.minTouchTarget,
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderRadius: SubwayTheme.radii.button,
    paddingHorizontal: SubwayTheme.spacing.md,
    paddingVertical: SubwayTheme.spacing.md,
    color: SubwayTheme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
  },
  timeField: {
    flex: 1,
  },
  timeSpacer: {
    width: SubwayTheme.spacing.md,
  },
  hint: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginBottom: SubwayTheme.spacing.lg,
  },
  errorBox: {
    borderWidth: 2,
    borderColor: SubwayTheme.colors.danger,
    borderRadius: SubwayTheme.radii.button,
    padding: SubwayTheme.spacing.md,
    marginBottom: SubwayTheme.spacing.lg,
    minHeight: SubwayTheme.minTouchTarget,
  },
  errorText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.danger,
  },
  errorDismiss: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.xs,
  },
  submit: {
    marginTop: SubwayTheme.spacing.sm,
  },
  credits: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
    textAlign: 'center',
    marginTop: SubwayTheme.spacing.md,
  },
  saved: {
    marginTop: SubwayTheme.spacing.xl,
  },
});
