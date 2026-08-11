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
import { PaperTheme, RECOVERY_CONFIDENCE_FLOOR } from '@streetlevel/shared';

import { PaperList } from '../components/PaperList';
import { PaperNotice } from '../components/PaperNotice';
import { PaperSection } from '../components/PaperSection';
import { PrimaryButton } from '../components/PrimaryButton';
import { RouteRibbon } from '../components/RouteRibbon';
import { RouteCardView } from '../components/RouteCardView';
import { PAPER_TOP } from '../lib/insets';
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
 *
 * Paper throughout, because at this moment there is no line to be confident in
 * — that is the entire problem. Once a station has been resolved the recovery
 * deck brings its own colour back, and the return of colour is itself the
 * message that the app knows where you are again.
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
        <View style={styles.foundRule} />
        <Text style={styles.foundCaption} allowFontScaling={false}>
          WE THINK YOU ARE HERE
        </Text>
        <Text style={styles.foundName}>{response.resolvedStationName}</Text>
        {response.resolvedPlatformDirection ? (
          <Text style={styles.foundDirection}>{response.resolvedPlatformDirection}</Text>
        ) : null}

        {/* The reasoning is shown, not hidden behind a "details" link: the
            traveller is the only one who can actually see the platform, so
            they are the final check on whether the engine guessed right. */}
        <PaperSection label="WHY WE THINK SO — CHECK THIS AGAINST WHAT YOU SEE">
          <Text style={styles.reasoning}>{response.reasoningPlainText}</Text>
        </PaperSection>

        <PrimaryButton
          label="That's not where I am"
          onPress={onTryAgain}
          tone="quiet"
          accessibilityHint="Describe your surroundings again."
          style={styles.secondaryAction}
        />

        <PaperSection
          label={
            intendedDestination
              ? `GETTING YOU TO ${intendedDestination.toUpperCase()}`
              : 'GETTING YOU BACK ON TRACK'
          }
        >
          <RouteRibbon
            segments={journeySpine(response.recoveryCards)}
            currentIndex={cardIndex}
            totalCards={response.recoveryCards.length}
          />
        </PaperSection>

        <View style={styles.recoveryCard}>
          {card ? (
            <RouteCardView
              card={card}
              stepIndex={cardIndex}
              stepTotal={response.recoveryCards.length}
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
            tone="quiet"
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
        <View style={styles.headRule} />
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
            <PaperNotice
              caption="NOT SURE ENOUGH TO SEND YOU ANYWHERE"
              text={
                'There are too many places in the city that match what you described, and pointing ' +
                'you down the wrong staircase would make this worse. A couple more details will settle it:'
              }
            />
          </View>
        ) : null}

        <PaperSection label={lowConfidence ? 'ANSWER ANY ONE OF THESE' : 'THINGS THAT HELP'}>
          <PaperList
            rows={(lowConfidence && questions.length > 0 ? questions : PROMPTS).map((text) => ({
              text,
            }))}
          />
          {lowConfidence ? (
            <Text style={styles.confidenceNote} allowFontScaling={false}>
              Confidence was {Math.round((session?.response.confidence ?? 0) * 100)}%. We only route
              you at {Math.round(RECOVERY_CONFIDENCE_FLOOR * 100)}% or better.
            </Text>
          ) : null}
        </PaperSection>

        <PaperSection label="IN YOUR OWN WORDS">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="There's a green pillar and a sign saying Uptown & The Bronx…"
            placeholderTextColor={PaperTheme.colors.inkMuted}
            style={styles.input}
            accessibilityLabel="Describe what you can see around you"
            multiline
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect
          />
        </PaperSection>

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
    marginBottom: 24,
  },
  title: {
    ...PaperTheme.type.headline,
    fontSize: 36,
    lineHeight: 40,
    color: PaperTheme.colors.ink,
  },
  body: {
    ...PaperTheme.type.body,
    color: PaperTheme.colors.inkMuted,
    marginTop: 14,
  },
  input: {
    minHeight: 128,
    backgroundColor: PaperTheme.colors.paperShade,
    padding: 16,
    color: PaperTheme.colors.ink,
    fontSize: 19,
    lineHeight: 27,
  },
  submit: {
    marginTop: 30,
  },
  secondaryAction: {
    marginTop: 14,
  },
  errorText: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.danger,
    marginTop: 20,
  },
  clarifyBox: {
    marginTop: 26,
  },
  confidenceNote: {
    ...PaperTheme.type.micro,
    lineHeight: 17,
    color: PaperTheme.colors.inkMuted,
    marginTop: 10,
  },
  /**
   * The answer arrives as a headline, not as a card floating on a background.
   * Someone who has just admitted they are lost needs the screen to look like
   * it knows something, and a station name set at full size under a printer's
   * rule says "found" before a word of it is read.
   */
  foundRule: {
    height: PaperTheme.rules.head,
    backgroundColor: PaperTheme.colors.success,
    marginBottom: 18,
  },
  foundCaption: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.success,
  },
  foundName: {
    ...PaperTheme.type.headline,
    fontSize: 38,
    lineHeight: 42,
    color: PaperTheme.colors.ink,
    marginTop: 10,
  },
  foundDirection: {
    ...PaperTheme.type.bodyStrong,
    color: PaperTheme.colors.success,
    marginTop: 6,
  },
  reasoning: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.ink,
  },
  // Tall enough that the paper zone under the statement is visible without a
  // second scroll. This screen already scrolls; a card that only ever showed
  // its statement would make the recovery deck feel like a worse deck.
  recoveryCard: {
    minHeight: 560,
    marginTop: 24,
  },
  stepControls: {
    flexDirection: 'row',
    marginTop: 20,
  },
  stepButton: {
    flex: 1,
  },
  stepButtonWide: {
    flex: 2,
  },
  stepSpacer: {
    width: 10,
  },
});
