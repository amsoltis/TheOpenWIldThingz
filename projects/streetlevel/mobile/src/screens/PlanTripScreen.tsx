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
import { PaperTheme, SubwayTheme } from '@streetlevel/shared';

import { PaperNotice } from '../components/PaperNotice';
import { PrimaryButton } from '../components/PrimaryButton';
import { resolveTripWindow } from '../lib/clock';
import { PAPER_TOP } from '../lib/insets';

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

/**
 * The front door, before any trip exists.
 *
 * There is no line yet, so there is no colour to state anything in — and
 * inventing a brand accent for the sake of a coloured header would teach the
 * traveller that the colour means nothing, which is precisely the lesson that
 * has to not be taught. The screen is therefore all paper: a form on a page,
 * set the way a form on a page is set.
 */
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
        <View style={styles.headRule} />
        <Text style={styles.kicker} allowFontScaling={false}>
          STREETLEVEL · NEW YORK CITY SUBWAY
        </Text>

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
            <PaperNotice caption="THAT DID NOT WORK" text={errorMessage} />
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

/**
 * A ruled line rather than a box.
 *
 * Boxes are how a dark interface makes an input findable; on paper a rule under
 * a label is how every form ever printed did it, and it leaves the value itself
 * as the largest thing in the field — which is what the traveller is checking.
 */
function Field({ label, placeholder, value, onChange, autoFocus, keyboard }: FieldProps): ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel} allowFontScaling={false}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={PaperTheme.colors.inkMuted}
        style={styles.input}
        accessibilityLabel={label}
        autoCorrect={false}
        autoCapitalize="words"
        autoFocus={autoFocus ?? false}
        keyboardType={keyboard === 'numbers-and-punctuation' ? 'numbers-and-punctuation' : 'default'}
        returnKeyType="next"
      />
      <View style={styles.fieldRule} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PaperTheme.colors.paper,
  },
  content: {
    paddingHorizontal: PaperTheme.margin,
    paddingTop: PAPER_TOP,
    paddingBottom: 64,
  },
  headRule: {
    height: PaperTheme.rules.head,
    backgroundColor: PaperTheme.colors.ink,
    marginBottom: 14,
  },
  kicker: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.inkMuted,
  },
  title: {
    ...PaperTheme.type.headline,
    color: PaperTheme.colors.ink,
    marginTop: 22,
  },
  subtitle: {
    ...PaperTheme.type.body,
    color: PaperTheme.colors.inkMuted,
    marginTop: 12,
    marginBottom: 34,
  },
  field: {
    marginBottom: 26,
  },
  fieldLabel: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.inkMuted,
    marginBottom: 6,
  },
  input: {
    minHeight: SubwayTheme.minTouchTarget - 8,
    paddingVertical: 8,
    color: PaperTheme.colors.ink,
    fontSize: 21,
    fontWeight: '700',
  },
  fieldRule: {
    height: 2,
    backgroundColor: PaperTheme.colors.ruleStrong,
  },
  timeRow: {
    flexDirection: 'row',
  },
  timeField: {
    flex: 1,
  },
  timeSpacer: {
    width: 20,
  },
  hint: {
    ...PaperTheme.type.aside,
    color: PaperTheme.colors.inkMuted,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: PaperTheme.colors.rule,
    marginBottom: 28,
  },
  errorBox: {
    marginBottom: 24,
    minHeight: SubwayTheme.minTouchTarget,
  },
  errorDismiss: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.inkMuted,
    marginTop: 10,
    textAlign: 'center',
  },
  submit: {
    marginTop: 4,
  },
  credits: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.inkMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  saved: {
    marginTop: 34,
  },
});
