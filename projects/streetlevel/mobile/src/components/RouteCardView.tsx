import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LineID, PhaseType, RouteCard } from '@streetlevel/shared';
import { LINE_COLORS, SubwayTheme, lineGlow, withAlpha } from '@streetlevel/shared';

import { AlertNote } from './AlertNote';
import { ExitSignPlate } from './ExitSignPlate';
import { LookForList } from './LookForList';
import { MarkdownText } from './MarkdownText';
import { StationPlate } from './StationPlate';
import { VerticalFade } from './VerticalFade';
import { boldPhrases, linesServedFrom, stationNameFrom } from '../lib/cardFacts';
import { EntranceApproachBody } from './phases/EntranceApproachBody';
import { ExitSurfacingBody } from './phases/ExitSurfacingBody';
import { MezzanineTransitBody } from './phases/MezzanineTransitBody';
import { OnTrainBody } from './phases/OnTrainBody';
import { PlatformWaitBody } from './phases/PlatformWaitBody';

interface RouteCardViewProps {
  card: RouteCard;
  stepLabel: string;
  /**
   * The line this card belongs to. Only PLATFORM_WAIT carries its own focus, so
   * the deck resolves the rest and hands it down — see `cardLines`.
   */
  line?: LineID | null;
  /**
   * The line the whole leg is about. Street walking belongs to no train, which
   * is the right answer for the ribbon and the wrong one for the card chrome —
   * someone walking to the 3 is still on a red trip, and a colourless card in
   * the middle of a coloured deck reads as a card that failed to load.
   */
  legLine?: LineID | null;
  /** Where the whole leg ends. Used by the phases that talk about arriving. */
  destinationLabel?: string | undefined;
}

const PHASE_CAPTIONS: Record<PhaseType, string> = {
  ENTRANCE_APPROACH: 'GETTING TO THE STAIRS',
  MEZZANINE_TRANSIT: 'INSIDE THE STATION',
  PLATFORM_WAIT: 'WAITING FOR YOUR TRAIN',
  ON_TRAIN: 'ON THE TRAIN',
  EXIT_SURFACING: 'COMING BACK UP',
};

/**
 * One instruction per card, full stop. The deck is the product's core claim:
 * the traveller is never asked to hold two steps in their head at once, and
 * never has to scan a wall of text for the line that applies to them right now.
 *
 * Below the instruction the card stops being a template. Waiting on a platform
 * and sitting on a moving train are not the same moment and must not look like
 * the same moment — one is a decision made in seconds against a train pulling
 * in, the other is twenty minutes of not getting off too early. A shared layout
 * for both is a layout that serves neither, so each phase gets its own body and
 * the shell keeps only what is genuinely common: who I am, what to do, and what
 * not to do.
 */
export function RouteCardView({
  card,
  stepLabel,
  line,
  legLine,
  destinationLabel,
}: RouteCardViewProps): ReactElement {
  const activeLine = line ?? card.targetLineFocus?.activeLineId ?? null;
  const chromeLine = activeLine ?? legLine ?? null;
  const accent = chromeLine ? LINE_COLORS[chromeLine] : undefined;

  return (
    <View
      style={[
        styles.card,
        accent ? { borderColor: withAlpha(accent, 0.32), boxShadow: lineGlow(accent) } : null,
      ]}
    >
      {/* The line's own colour, washed across the head of the card and fading
          out rather than ending in an edge. The card the traveller is holding
          and the bullet hanging over the track are then obviously the same
          object, without repainting anything that has to stay MTA-accurate. */}
      {accent ? (
        <VerticalFade color={accent} height={210} anchor="top" maxAlpha={0.13} />
      ) : null}
      {accent ? <View style={[styles.accentRule, { backgroundColor: accent }]} /> : null}

      <View style={styles.header}>
        <Text style={styles.phase} allowFontScaling={false}>
          {PHASE_CAPTIONS[card.phaseType]}
        </Text>
        <View style={styles.stepChip}>
          <Text style={styles.step} allowFontScaling={false}>
            {stepLabel}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PhaseIdentity card={card} line={chromeLine} />

        <MarkdownText
          source={card.primaryInstructionMarkdown}
          style={styles.instruction}
          secondaryStyle={styles.instructionSecondary}
          secondaryColor={SubwayTheme.colors.textSecondary}
        />

        {/* Directly under the instruction on every phase. This is the "do not
            walk down those stairs" text and it is worthless below a fold.

            The exception is the train: there the warning is about the very
            first stop, so the ladder places it on that stop itself rather than
            floating it above and pushing all fourteen stops out of view. */}
        {card.criticalAvoidanceNotes && !PHASES_PLACING_THEIR_OWN_ALERT.has(card.phaseType) ? (
          <View style={styles.avoidance}>
            <AlertNote caption="DO NOT" text={card.criticalAvoidanceNotes} />
          </View>
        ) : null}

        <PhaseBody
          card={card}
          line={activeLine}
          accent={accent}
          destinationLabel={destinationLabel}
        />
      </ScrollView>

      {/* Cards are taller than the viewport by design; this is how the card
          says so without a scrollbar the traveller has to notice. */}
      <VerticalFade color={SubwayTheme.colors.surfaceCard} height={28} anchor="bottom" />
    </View>
  );
}

/** Phases whose body owns where its warning goes, because position carries meaning. */
const PHASES_PLACING_THEIR_OWN_ALERT: ReadonlySet<string> = new Set(['ON_TRAIN']);

/**
 * The heroes allowed to sit above the instruction.
 *
 * Both are above-ground moments, and both share a property the underground
 * phases do not: the traveller is comparing the phone against a whole street,
 * not against one platform. What helps is an object — a station name with its
 * bullets, an EXIT plate — that can be held up and matched. The sentence about
 * how many minutes the walk takes is the caption to that, not the other way
 * round. Underground, where the station is already settled, the instruction
 * rightly leads and the hero follows it.
 */
function PhaseIdentity({ card, line }: { card: RouteCard; line: LineID | null }): ReactElement | null {
  if (card.phaseType === 'ENTRANCE_APPROACH') {
    const stationName = stationNameFrom(card.visualAnchors);
    if (!stationName) return null;
    return (
      <View style={styles.identity}>
        <StationPlate
          name={stationName}
          linesServed={linesServedFrom(card.visualAnchors)}
          accentLine={line}
          eyebrow="THE STATION YOU ARE LOOKING FOR"
          size="inline"
        />
      </View>
    );
  }

  if (card.phaseType === 'EXIT_SURFACING') {
    return (
      <View style={styles.identity}>
        <ExitSignPlate stationName={boldPhrases(card.primaryInstructionMarkdown)[0] ?? null} />
      </View>
    );
  }

  return null;
}

interface PhaseBodyProps {
  card: RouteCard;
  line: LineID | null;
  accent: string | undefined;
  destinationLabel: string | undefined;
}

function PhaseBody({ card, line, accent, destinationLabel }: PhaseBodyProps): ReactElement {
  switch (card.phaseType) {
    case 'ENTRANCE_APPROACH':
      return <EntranceApproachBody card={card} accent={accent} />;
    case 'MEZZANINE_TRANSIT':
      return <MezzanineTransitBody card={card} line={line} accent={accent} />;
    case 'PLATFORM_WAIT':
      return <PlatformWaitBody card={card} accent={accent} />;
    case 'ON_TRAIN':
      return (
        <OnTrainBody
          card={card}
          line={line}
          accent={accent}
          destinationLabel={destinationLabel}
        />
      );
    case 'EXIT_SURFACING':
      return (
        <ExitSurfacingBody card={card} accent={accent} destinationLabel={destinationLabel} />
      );
    default:
      return <LookForList anchors={card.visualAnchors} accent={accent} />;
  }
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderRadius: SubwayTheme.radii.card,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
    paddingHorizontal: SubwayTheme.spacing.lg,
    paddingBottom: SubwayTheme.spacing.sm,
    overflow: 'hidden',
    boxShadow: SubwayTheme.elevation.card,
  },
  accentRule: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SubwayTheme.spacing.md,
    paddingBottom: SubwayTheme.spacing.sm,
  },
  phase: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textPrimary,
    opacity: 0.85,
  },
  stepChip: {
    borderRadius: SubwayTheme.radii.bullet,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairlineStrong,
    paddingHorizontal: SubwayTheme.spacing.sm,
    paddingVertical: 3,
  },
  step: {
    ...SubwayTheme.typography.microLabel,
    fontSize: 10,
    color: SubwayTheme.colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SubwayTheme.spacing.lg,
  },
  instruction: {
    ...SubwayTheme.typography.cardInstruction,
    color: SubwayTheme.colors.textPrimary,
  },
  instructionSecondary: {
    ...SubwayTheme.typography.supportBody,
    fontSize: 16,
    lineHeight: 22,
    color: SubwayTheme.colors.textSecondary,
  },
  identity: {
    marginBottom: SubwayTheme.spacing.md,
  },
  avoidance: {
    marginTop: SubwayTheme.spacing.sm,
  },
});
