import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RECOVERY_CONFIDENCE_FLOOR, SubwayTheme } from '@streetlevel/shared';

import { PhaseProgress } from '../components/PhaseProgress';
import { PrimaryButton } from '../components/PrimaryButton';
import { RouteCardView } from '../components/RouteCardView';
import { showsRecoveryRoute } from '../state/appMachine';
import type { RecoverySession } from '../state/appMachine';

interface RecoveryScreenProps {
  session: RecoverySession | null;
  isBusy: boolean;
  errorMessage: string | null;
  intendedDestination: string | null;
  onSubmit: (surroundingsDescription: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onTryAgain: () => void;
  onDismiss: () => void;
}

const PROMPTS = [
  'What does the sign on the wall say?',
  'What colour are the tiles or the pillars?',
  'Is there a staircase, an escalator, or a lift near you?',
  'Can you see daylight?',
];

/**
 * The panic button's landing page.
 *
 * Tone is doing real work here. Someone who taps "I messed up" is embarrassed
 * and probably rushing, so the screen opens with a question rather than an
 * error, asks for the things you can genuinely see underground, and never
 * implies they did something wrong.
 */
export function RecoveryScreen({
  session,
  isBusy,
  errorMessage,
  intendedDestination,
  onSubmit,
  onNext,
  onPrev,
  onTryAgain,
  onDismiss,
}: RecoveryScreenProps): ReactElement {
  const [description, setDescription] = useState('');
  const resolved = session && showsRecoveryRoute(session.response);

  if (session && resolved) {
    const { response, cardIndex } = session;
    const card = response.recoveryCards[cardIndex];
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.caption}>WE THINK YOU ARE HERE</Text>
        <Text style={styles.stationName}>{response.resolvedStationName}</Text>
        {response.resolvedPlatformDirection ? (
          <Text style={styles.platformDirection}>{response.resolvedPlatformDirection}</Text>
        ) : null}

        {/* The reasoning is shown, not hidden behind a "details" link: the
            traveller is the only one who can actually see the platform, so they
            are the final check on whether the engine guessed right. */}
        <View style={styles.reasoningBox}>
          <Text style={styles.reasoningCaption}>WHY WE THINK SO — CHECK THIS AGAINST WHAT YOU SEE</Text>
          <Text style={styles.reasoningText}>{response.reasoningPlainText}</Text>
        </View>

        <PrimaryButton
          label="That's not where I am"
          onPress={onTryAgain}
          tone="quiet"
          accessibilityHint="Describe your surroundings again."
          style={styles.secondaryAction}
        />

        <View style={styles.deckHeader}>
          <Text style={styles.caption}>
            {intendedDestination ? `GETTING YOU TO ${intendedDestination.toUpperCase()}` : 'GETTING YOU BACK ON TRACK'}
          </Text>
          <PhaseProgress total={response.recoveryCards.length} currentIndex={cardIndex} />
        </View>

        <View style={styles.recoveryCard}>
          {card ? (
            <RouteCardView
              card={card}
              stepLabel={`STEP ${cardIndex + 1} OF ${response.recoveryCards.length}`}
            />
          ) : null}
        </View>

        <View style={styles.stepControls}>
          <PrimaryButton
            label="Back"
            onPress={onPrev}
            tone="secondary"
            disabled={cardIndex === 0}
            accessibilityHint="Shows the previous recovery step."
            style={styles.stepButton}
          />
          <View style={styles.stepSpacer} />
          <PrimaryButton
            label="Next"
            onPress={onNext}
            disabled={cardIndex >= response.recoveryCards.length - 1}
            accessibilityHint="Shows the next recovery step."
            style={styles.stepButtonWide}
          />
        </View>

        <PrimaryButton
          label="Back to my trip"
          onPress={onDismiss}
          tone="quiet"
          style={styles.secondaryAction}
        />
      </ScrollView>
    );
  }

  const lowConfidence = session !== null && !resolved;
  const questions = session?.response.clarifyingQuestions ?? [];

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Tell me what you can see around you.</Text>
        <Text style={styles.body}>
          Take your time. Anything counts — a sign, a shop, a colour, a smell of the street. We will
          work out where you are from that.
        </Text>

        {/* Below the confidence floor we deliberately show no route at all.
            Handing an already-lost traveller a confident guess is the single
            worst thing this product can do, so we ask instead of inventing. */}
        {lowConfidence ? (
          <View style={styles.clarifyBox}>
            <Text style={styles.clarifyCaption}>NOT SURE ENOUGH TO SEND YOU ANYWHERE</Text>
            <Text style={styles.clarifyIntro}>
              There are too many places in the city that match what you described, and pointing you
              down the wrong staircase would make this worse. A couple more details will settle it:
            </Text>
            {(questions.length > 0 ? questions : PROMPTS).map((question, index) => (
              <View key={`${question}-${index}`} style={styles.questionRow}>
                <Text style={styles.questionMark} accessibilityElementsHidden>
                  ?
                </Text>
                <Text style={styles.questionText}>{question}</Text>
              </View>
            ))}
            <Text style={styles.confidenceNote}>
              Confidence was {Math.round((session?.response.confidence ?? 0) * 100)}%. We only route
              you at {Math.round(RECOVERY_CONFIDENCE_FLOOR * 100)}% or better.
            </Text>
          </View>
        ) : (
          <View style={styles.promptList}>
            {PROMPTS.map((prompt) => (
              <Text key={prompt} style={styles.promptText}>
                • {prompt}
              </Text>
            ))}
          </View>
        )}

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="There's a green pillar and a sign saying Uptown & The Bronx…"
          placeholderTextColor={SubwayTheme.colors.textSecondary}
          style={styles.input}
          accessibilityLabel="Describe what you can see around you"
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
          autoCorrect
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <PrimaryButton
          label={isBusy ? 'Working out where you are…' : 'Find me'}
          onPress={() => onSubmit(description.trim())}
          disabled={isBusy || description.trim().length < 3}
          accessibilityHint="Sends your description and returns directions from where you actually are."
          style={styles.submit}
        />

        <PrimaryButton
          label="Never mind, back to my trip"
          onPress={onDismiss}
          tone="quiet"
          style={styles.secondaryAction}
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginTop: SubwayTheme.spacing.md,
  },
  body: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.sm,
  },
  promptList: {
    marginTop: SubwayTheme.spacing.md,
  },
  promptText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
  },
  input: {
    minHeight: 140,
    marginTop: SubwayTheme.spacing.lg,
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderRadius: SubwayTheme.radii.button,
    padding: SubwayTheme.spacing.md,
    color: SubwayTheme.colors.textPrimary,
    fontSize: 20,
    lineHeight: 28,
  },
  submit: {
    marginTop: SubwayTheme.spacing.lg,
  },
  secondaryAction: {
    marginTop: SubwayTheme.spacing.md,
  },
  errorText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.danger,
    marginTop: SubwayTheme.spacing.md,
  },
  clarifyBox: {
    marginTop: SubwayTheme.spacing.lg,
    padding: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.button,
    borderWidth: 2,
    borderColor: SubwayTheme.colors.danger,
  },
  clarifyCaption: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.danger,
  },
  clarifyIntro: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textPrimary,
    marginTop: SubwayTheme.spacing.sm,
    marginBottom: SubwayTheme.spacing.md,
  },
  questionRow: {
    flexDirection: 'row',
    marginBottom: SubwayTheme.spacing.sm,
  },
  questionMark: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.danger,
    marginRight: SubwayTheme.spacing.sm,
  },
  questionText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textPrimary,
    flexShrink: 1,
  },
  confidenceNote: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.sm,
  },
  caption: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
  },
  stationName: {
    ...SubwayTheme.typography.macroActionTitle,
    color: SubwayTheme.colors.textPrimary,
    marginTop: SubwayTheme.spacing.sm,
  },
  platformDirection: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.success,
    marginTop: SubwayTheme.spacing.xs,
  },
  reasoningBox: {
    marginTop: SubwayTheme.spacing.lg,
    padding: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.button,
    backgroundColor: SubwayTheme.colors.surfaceCard,
  },
  reasoningCaption: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
    marginBottom: SubwayTheme.spacing.sm,
  },
  reasoningText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textPrimary,
  },
  deckHeader: {
    marginTop: SubwayTheme.spacing.xl,
    marginBottom: SubwayTheme.spacing.md,
  },
  recoveryCard: {
    minHeight: 320,
  },
  stepControls: {
    flexDirection: 'row',
    marginTop: SubwayTheme.spacing.md,
  },
  stepButton: {
    flex: 1,
  },
  stepButtonWide: {
    flex: 2,
  },
  stepSpacer: {
    width: SubwayTheme.spacing.sm,
  },
});
