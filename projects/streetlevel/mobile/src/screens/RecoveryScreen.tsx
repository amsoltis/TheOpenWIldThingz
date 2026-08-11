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

import { AlertNote } from '../components/AlertNote';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionCaption } from '../components/SectionCaption';
import { RouteRibbon } from '../components/RouteRibbon';
import { RouteCardView } from '../components/RouteCardView';
import { cardLines, journeySpine } from '../lib/journey';
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
    const lines = cardLines(response.recoveryCards);

    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.foundPlate}>
          <View style={styles.foundCap} />
          <View style={styles.foundBody}>
            <Text style={styles.caption} allowFontScaling={false}>
              WE THINK YOU ARE HERE
            </Text>
            <Text style={styles.stationName}>{response.resolvedStationName}</Text>
            {response.resolvedPlatformDirection ? (
              <Text style={styles.platformDirection}>{response.resolvedPlatformDirection}</Text>
            ) : null}

            {/* The reasoning is shown, not hidden behind a "details" link: the
                traveller is the only one who can actually see the platform, so
                they are the final check on whether the engine guessed right. */}
            <View style={styles.reasoningBox}>
              <Text style={styles.reasoningCaption} allowFontScaling={false}>
                WHY WE THINK SO — CHECK THIS AGAINST WHAT YOU SEE
              </Text>
              <Text style={styles.reasoningText}>{response.reasoningPlainText}</Text>
            </View>
          </View>
        </View>

        <PrimaryButton
          label="That's not where I am"
          onPress={onTryAgain}
          tone="quiet"
          accessibilityHint="Describe your surroundings again."
          style={styles.secondaryAction}
        />

        <View style={styles.deckHeader}>
          <Text style={styles.caption} allowFontScaling={false}>
            {intendedDestination ? `GETTING YOU TO ${intendedDestination.toUpperCase()}` : 'GETTING YOU BACK ON TRACK'}
          </Text>
          <View style={styles.deckRibbon}>
            <RouteRibbon
              segments={journeySpine(response.recoveryCards)}
              currentIndex={cardIndex}
              totalCards={response.recoveryCards.length}
            />
          </View>
        </View>

        <View style={styles.recoveryCard}>
          {card ? (
            <RouteCardView
              card={card}
              stepLabel={`STEP ${cardIndex + 1} OF ${response.recoveryCards.length}`}
              line={lines[cardIndex] ?? null}
              legLine={lines.find((l) => l !== null) ?? null}
              destinationLabel={intendedDestination ?? undefined}
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
            <AlertNote
              caption="NOT SURE ENOUGH TO SEND YOU ANYWHERE"
              text={
                'There are too many places in the city that match what you described, and pointing ' +
                'you down the wrong staircase would make this worse. A couple more details will settle it:'
              }
            />
          </View>
        ) : null}

        <View style={styles.prompts}>
          <SectionCaption
            label={lowConfidence ? 'ANSWER ANY ONE OF THESE' : 'THINGS THAT HELP'}
            {...(lowConfidence ? { accent: SubwayTheme.colors.danger } : {})}
          />
          <View style={styles.promptWell}>
            {(lowConfidence && questions.length > 0 ? questions : PROMPTS).map((prompt, index) => (
              <View
                key={`${prompt}-${index}`}
                style={[styles.promptRow, index > 0 ? styles.promptDivided : null]}
              >
                <View style={styles.promptMark} accessibilityElementsHidden>
                  <Text style={styles.promptMarkGlyph} allowFontScaling={false}>
                    ?
                  </Text>
                </View>
                <Text style={styles.promptText}>{prompt}</Text>
              </View>
            ))}
          </View>
          {lowConfidence ? (
            <Text style={styles.confidenceNote} allowFontScaling={false}>
              Confidence was {Math.round((session?.response.confidence ?? 0) * 100)}%. We only route
              you at {Math.round(RECOVERY_CONFIDENCE_FLOOR * 100)}% or better.
            </Text>
          ) : null}
        </View>

        <View style={styles.inputBlock}>
          <SectionCaption label="IN YOUR OWN WORDS" />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="There's a green pillar and a sign saying Uptown & The Bronx…"
            placeholderTextColor={SubwayTheme.colors.textTertiary}
            style={styles.input}
            accessibilityLabel="Describe what you can see around you"
            multiline
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect
          />
        </View>

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
    backgroundColor: SubwayTheme.colors.backgroundDeep,
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
    ...SubwayTheme.typography.sectionTitle,
    fontSize: 17,
    lineHeight: 24,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.sm,
  },
  /**
   * The prompts are the whole interaction: someone underground cannot answer
   * "where are you", but they can answer "what colour are the pillars". Set as
   * a list of loose bullet lines they read as filler, so they get the same
   * well and the same rhythm as the LOOK FOR list on a route card — a set of
   * questions to work through, not a paragraph of suggestions.
   */
  prompts: {
    marginTop: SubwayTheme.spacing.lg,
  },
  promptWell: {
    marginTop: SubwayTheme.spacing.sm,
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderRadius: SubwayTheme.radii.chip,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
    paddingHorizontal: SubwayTheme.spacing.md,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SubwayTheme.spacing.md,
  },
  promptDivided: {
    borderTopWidth: SubwayTheme.borders.hairline,
    borderTopColor: SubwayTheme.colors.hairline,
  },
  promptMark: {
    width: 24,
    height: 24,
    borderRadius: SubwayTheme.radii.bullet,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairlineStrong,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SubwayTheme.spacing.md,
  },
  promptMarkGlyph: {
    fontSize: 13,
    fontWeight: '900',
    color: SubwayTheme.colors.textSecondary,
    includeFontPadding: false,
  },
  promptText: {
    ...SubwayTheme.typography.supportBody,
    fontSize: 16,
    lineHeight: 22,
    color: SubwayTheme.colors.textPrimary,
    flexShrink: 1,
  },
  inputBlock: {
    marginTop: SubwayTheme.spacing.lg,
  },
  input: {
    minHeight: 132,
    marginTop: SubwayTheme.spacing.sm,
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderRadius: SubwayTheme.radii.button,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairlineStrong,
    padding: SubwayTheme.spacing.md,
    color: SubwayTheme.colors.textPrimary,
    fontSize: 19,
    lineHeight: 27,
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
  },
  confidenceNote: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textTertiary,
    marginTop: SubwayTheme.spacing.sm,
  },
  caption: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textSecondary,
  },
  /**
   * The answer arrives as a solid, confident object rather than as loose text.
   * Someone who has just admitted they are lost needs the screen to look like
   * it knows something, and a green cap over a raised plate says "found" before
   * a single word of it is read.
   */
  foundPlate: {
    borderRadius: SubwayTheme.radii.card,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
    backgroundColor: SubwayTheme.colors.surfaceRaised,
    overflow: 'hidden',
    boxShadow: SubwayTheme.elevation.card,
  },
  foundCap: {
    height: 6,
    backgroundColor: SubwayTheme.colors.success,
  },
  foundBody: {
    padding: SubwayTheme.spacing.lg,
  },
  stationName: {
    ...SubwayTheme.typography.macroActionTitle,
    color: SubwayTheme.colors.textPrimary,
    marginTop: SubwayTheme.spacing.sm,
  },
  platformDirection: {
    ...SubwayTheme.typography.bodyStrong,
    color: SubwayTheme.colors.success,
    marginTop: SubwayTheme.spacing.xs,
  },
  reasoningBox: {
    marginTop: SubwayTheme.spacing.lg,
    padding: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.chip,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
  },
  reasoningCaption: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textTertiary,
    marginBottom: SubwayTheme.spacing.sm,
  },
  reasoningText: {
    ...SubwayTheme.typography.bodyStrong,
    color: SubwayTheme.colors.textPrimary,
  },
  deckHeader: {
    marginTop: SubwayTheme.spacing.xl,
    marginBottom: SubwayTheme.spacing.md,
  },
  deckRibbon: {
    marginTop: SubwayTheme.spacing.sm,
  },
  // Tall enough that the phase body under the instruction is visible without a
  // second scroll. This screen already scrolls; a card that only ever showed
  // its headline would make the recovery deck feel like a worse deck.
  recoveryCard: {
    minHeight: 520,
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
