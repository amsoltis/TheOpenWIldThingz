import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import type { LineID, RouteCard } from '@streetlevel/shared';
import { LINE_COLORS, PaperTheme } from '@streetlevel/shared';

import { MarkdownText } from './MarkdownText';
import { StatementZone } from './StatementZone';
import { statementFor } from '../lib/statement';
import { EntranceApproachBody } from './phases/EntranceApproachBody';
import { ExitSurfacingBody } from './phases/ExitSurfacingBody';
import { MezzanineTransitBody } from './phases/MezzanineTransitBody';
import { OnTrainBody } from './phases/OnTrainBody';
import { PlatformWaitBody } from './phases/PlatformWaitBody';

interface RouteCardViewProps {
  card: RouteCard;
  /** Zero-based position in the deck. The rail and the "3 / 5" both read it. */
  stepIndex: number;
  stepTotal: number;
  /**
   * The line this card belongs to. Only PLATFORM_WAIT carries its own focus, so
   * the deck resolves the rest and hands it down — see `cardLines`.
   */
  line?: LineID | null;
  /**
   * The line the whole leg is about. Street walking belongs to no train, which
   * is the right answer for the ribbon and the wrong one for the statement —
   * someone walking to the 3 is still on a red trip, and a card that changed
   * colour halfway through a leg would read as a different trip.
   */
  legLine?: LineID | null;
  /** Where the whole leg ends. Used by the phases that talk about arriving. */
  destinationLabel?: string | undefined;
  /** Reference material the deck owns, printed at the foot of the paper zone. */
  trailing?: ReactNode;
}

/**
 * Two zones, one card. The statement, then the enumeration.
 *
 * The top of every card is the active line's colour, floor to ceiling, holding
 * one thing: WAIT HERE, 14 STOPS TO GO, UP AND OUT. That zone is not read so
 * much as recognised — it is the answer to "what am I doing", available at
 * arm's length, in motion, in the dark.
 *
 * Below it the card turns to paper and stops shouting. This is where the list
 * lives: the stops in order, the things to look for, the prohibition. Scrolling
 * from one into the other is the same movement as lowering the phone from
 * glance-distance to reading-distance, and the card is built so that the
 * gesture and the intent match.
 *
 * What is emphatically *not* here any more is a shell that treated all five
 * phases as the same template with different words in it. Waiting on a platform
 * and sitting on a moving train are not the same moment; each phase still owns
 * its own enumeration, and the shell keeps only what is genuinely common — who
 * I am, what to do, and what not to do.
 */
export function RouteCardView({
  card,
  stepIndex,
  stepTotal,
  line,
  legLine,
  destinationLabel,
  trailing,
}: RouteCardViewProps): ReactElement {
  const [box, setBox] = useState({ width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT });

  const activeLine = line ?? card.targetLineFocus?.activeLineId ?? null;
  const statementLine = activeLine ?? legLine ?? null;
  const accent = statementLine ? LINE_COLORS[statementLine] : undefined;
  const statement = statementFor(card, activeLine ?? legLine ?? null);

  /**
   * The statement takes roughly three-quarters of whatever it is given, which
   * leaves the head of the paper zone visible under it. That sliver is the only
   * invitation to scroll the card needs — a printed rule and the first line of
   * a list peeking above the fold says "there is more" more honestly than any
   * chevron or the word "scroll" would.
   */
  const statementHeight = Math.min(Math.round(box.height * STATEMENT_SHARE), STATEMENT_MAX);

  const onLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setBox({ width, height });
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StatementZone
          statement={statement}
          line={statementLine}
          stepIndex={stepIndex}
          stepTotal={stepTotal}
          ghosts={card.targetLineFocus?.coLocatedLinesToDim ?? []}
          warning={
            PHASES_PLACING_THEIR_OWN_ALERT.has(card.phaseType)
              ? undefined
              : card.criticalAvoidanceNotes
          }
          width={box.width}
          minHeight={statementHeight}
        />

        <View style={styles.paper}>
          <View style={styles.headRule} />

          {/* The instruction in full. The statement above is a compression of
              it and drops real detail — which minutes, which borough, what the
              stop is actually for — so the sentence the compiler wrote is
              printed here intact rather than paraphrased away. */}
          <MarkdownText
            source={card.primaryInstructionMarkdown}
            style={styles.instruction}
            color={PaperTheme.colors.ink}
            secondaryStyle={styles.instructionSecondary}
            secondaryColor={PaperTheme.colors.inkMuted}
          />

          {/* The prohibition is not printed here. It rides in the colour zone
              above, where it cannot fall below the fold — a warning you have to
              scroll to find is a warning for people who were not in a hurry.
              The train is the exception: there it is about the very first stop,
              so the ladder places it on that stop itself. */}

          <PhaseBody
            card={card}
            line={activeLine}
            accent={accent}
            destinationLabel={destinationLabel}
          />

          {trailing}
        </View>
      </ScrollView>
    </View>
  );
}

/** Phases whose body owns where its warning goes, because position carries meaning. */
const PHASES_PLACING_THEIR_OWN_ALERT: ReadonlySet<string> = new Set(['ON_TRAIN']);

/**
 * How much of the card the statement takes when its own content is shorter
 * than that. Two thirds reads as "the screen is the statement"; much more and
 * the paper stops peeking, which is the only thing telling anyone to scroll.
 */
const STATEMENT_SHARE = 0.68;

/**
 * And a ceiling, in points. A share alone would let a tablet or a very tall
 * phone hand the statement a thousand points of colour, which stops being a
 * statement and becomes a wall — the type does not get any bigger, so all the
 * extra height buys is empty field between the words and the rail.
 */
const STATEMENT_MAX = 640;

/** Only used for the first frame, before the card has been measured. */
const FALLBACK_WIDTH = 390;
const FALLBACK_HEIGHT = 780;

interface PhaseBodyProps {
  card: RouteCard;
  line: LineID | null;
  accent: string | undefined;
  destinationLabel: string | undefined;
}

function PhaseBody({ card, line, accent, destinationLabel }: PhaseBodyProps): ReactElement {
  switch (card.phaseType) {
    case 'ENTRANCE_APPROACH':
      return <EntranceApproachBody card={card} />;
    case 'MEZZANINE_TRANSIT':
      return <MezzanineTransitBody card={card} line={line} />;
    case 'PLATFORM_WAIT':
      return <PlatformWaitBody card={card} />;
    case 'ON_TRAIN':
      return <OnTrainBody card={card} line={line} accent={accent} destinationLabel={destinationLabel} />;
    case 'EXIT_SURFACING':
      return <ExitSurfacingBody card={card} destinationLabel={destinationLabel} />;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PaperTheme.colors.paper,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  paper: {
    flexGrow: 1,
    backgroundColor: PaperTheme.colors.paper,
    paddingHorizontal: PaperTheme.margin,
    paddingBottom: 40,
  },
  /**
   * The heavy rule under the colour. Printed matter opens a page this way, and
   * here it does a second job: it is the seam between the two materials, so the
   * eye is told the shouting has stopped before it reads a word.
   */
  headRule: {
    height: PaperTheme.rules.head,
    backgroundColor: PaperTheme.colors.ink,
    marginTop: 26,
    marginBottom: 20,
  },
  instruction: {
    ...PaperTheme.type.body,
    fontSize: 19,
    lineHeight: 27,
  },
  instructionSecondary: {
    ...PaperTheme.type.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 6,
  },
  avoidance: {
    marginTop: 20,
  },
});
