import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineID } from '@streetlevel/shared';
import {
  LINE_COLORS,
  LINE_TEXT_COLORS,
  PaperTheme,
  StatementTheme,
  safeSecondaryOpacity,
  statementFontSize,
} from '@streetlevel/shared';

import { SegmentedRail } from './SegmentedRail';
import { STATEMENT_TOP } from '../lib/insets';
import { colourIsAmbiguous } from '../lib/lineCopy';
import type { Statement } from '../lib/statement';

interface StatementZoneProps {
  statement: Statement;
  /**
   * The line whose colour becomes the room. Never an accent — the whole field.
   * Null on the rare card that belongs to no train (a walking-only recovery
   * deck), where the zone reverses to ink and paper rather than borrowing a
   * colour it has no right to.
   */
  line: LineID | null;
  stepIndex: number;
  stepTotal: number;
  /** Co-located lines the traveller will watch pull in and must not board. */
  ghosts?: readonly LineID[];
  /**
   * The prohibition, when the card has one. It lives on the colour rather than
   * on the paper because it is the only thing on a card whose job is to stop
   * something going wrong, and below the fold it cannot do that job.
   */
  warning?: string | undefined;
  /** Measured from the card, so the headline can be fitted to the real column. */
  width: number;
  minHeight: number;
}

/**
 * The line colour is not an accent, it is the room.
 *
 * Someone looking for the 3 is looking for a red circle hanging over a track.
 * Making the screen that circle means the match happens before any reading
 * does — which matters because the reading is the slow, anxious, error-prone
 * step, and because at the moment a train is pulling in there is no time for
 * it. Type is set the way the Transit Authority sets it: one weight, one case,
 * tight, left-ranged on a hard grid.
 *
 * Ink is always `LINE_TEXT_COLORS`, never white. The Broadway yellow takes
 * black type — on the physical bullet and here — and a hardcoded white would
 * turn the N, Q, R and W into blank screens.
 */
export function StatementZone({
  statement,
  line,
  stepIndex,
  stepTotal,
  ghosts = [],
  warning,
  width,
  minHeight,
}: StatementZoneProps): ReactElement {
  const field = line ? LINE_COLORS[line] : PaperTheme.colors.ink;
  const ink = line ? LINE_TEXT_COLORS[line] : PaperTheme.colors.paper;
  const margin = StatementTheme.margin;
  // Spent only where the pairing can afford it — see `safeSecondaryOpacity`.
  const held = safeSecondaryOpacity(field, ink, 0.75);

  // The graphic bleeds in from the right, so the headline gets a narrower
  // column and is fitted to it rather than allowed to wrap under the bullet.
  const column = Math.max(width - margin * 2 - GRAPHIC_INTRUSION, 160);
  const isCounter = statement.graphic === 'counter';
  const headlineSize = isCounter
    ? StatementTheme.type.counterLabel.fontSize
    : statementFontSize(statement.headline, column);

  return (
    <View style={[styles.root, { backgroundColor: field, minHeight, paddingHorizontal: margin }]}>
      <View style={styles.topRow}>
        <Text style={[styles.kicker, { color: ink }]} allowFontScaling={false}>
          {statement.kicker}
        </Text>
        <Text style={[styles.kicker, { color: ink, opacity: held }]} allowFontScaling={false}>
          {stepIndex + 1} / {stepTotal}
        </Text>
      </View>

      {statement.graphic === 'bullet' && line ? <BleedBullet line={line} /> : null}
      {statement.graphic === 'exit' ? <BleedExit ink={ink} /> : null}

      {statement.counter ? (
        <Text
          style={[styles.counter, { color: ink }]}
          allowFontScaling={false}
          accessibilityElementsHidden
        >
          {statement.counter}
        </Text>
      ) : null}

      <Text
        style={[
          styles.headline,
          {
            color: ink,
            fontSize: headlineSize,
            lineHeight: Math.round(headlineSize * StatementTheme.type.headlineLeading),
            letterSpacing: isCounter
              ? StatementTheme.type.counterLabel.letterSpacing
              : StatementTheme.type.headlineTracking * (headlineSize / StatementTheme.type.headlineMax),
            maxWidth: isCounter ? undefined : column + 28,
            marginTop: isCounter ? COUNTER_LABEL_TOP : HEADLINE_TOP,
          },
        ]}
        allowFontScaling={false}
      >
        {statement.headline.join('\n')}
      </Text>

      {/* The sub line sits level with the widest part of the bleeding graphic,
          so it is the one piece of type that must be kept out from under it.
          The name below clears the circle's bottom tangent and can run wider. */}
      {statement.sub ? (
        <Text
          style={[
            styles.sub,
            { color: ink, opacity: held, maxWidth: isCounter ? undefined : column - 40 },
          ]}
          numberOfLines={2}
        >
          {statement.sub}
        </Text>
      ) : null}

      {statement.name ? (
        <Text
          style={[styles.name, { color: ink, maxWidth: isCounter ? undefined : column + 28 }]}
          numberOfLines={3}
        >
          {statement.name}
        </Text>
      ) : null}

      {statement.plate ? <SignPlate legend={statement.plate} exit={statement.graphic === 'exit'} /> : null}

      {ghosts.length > 0 && line ? (
        <GhostRow ghosts={ghosts} line={line} ink={ink} held={held} />
      ) : null}

      {statement.footnote ? (
        <View style={styles.footnote}>
          <View style={[styles.footnoteRule, { backgroundColor: ink }]} />
          <Text style={[styles.kicker, { color: ink, opacity: held }]} allowFontScaling={false}>
            {statement.footnote.label}
          </Text>
          <Text style={[styles.footnoteValue, { color: ink }]} numberOfLines={2}>
            {statement.footnote.value}
          </Text>
        </View>
      ) : null}

      {warning ? <WarningPlate text={warning} /> : null}

      <SegmentedRail
        index={stepIndex}
        total={stepTotal}
        color={ink}
        style={[styles.rail, { left: margin, right: margin }]}
      />
    </View>
  );
}

/**
 * The prohibition, set on the black plate.
 *
 * The plate is the one thing in this interface that belongs to neither the
 * colour system nor the paper system — it is a picture of a real object, and it
 * therefore reads on top of any of the twenty-three line colours without being
 * restyled for each. That is exactly what a warning needs: yellow is the field
 * where every tinted panel fails, and a warning that disappears on the Broadway
 * lines is worse than no warning at all.
 *
 * Set in full white on black rather than in the danger red. On a red field, red
 * is invisible; on yellow it is illegible. The plate carries the alarm by being
 * the only black rectangle on a wall of colour.
 */
function WarningPlate({ text }: { text: string }): ReactElement {
  return (
    <View style={styles.warning} accessibilityRole="alert">
      <Text style={styles.warningCaption} allowFontScaling={false}>
        DO NOT
      </Text>
      <Text style={styles.warningText}>{text}</Text>
    </View>
  );
}

/** How far the right-hand graphic reaches into the headline's column. */
const GRAPHIC_INTRUSION = 102;
const HEADLINE_TOP = 70;
/**
 * Pulls STOPS TO GO up under the numeral. The counter is set on a line box
 * shorter than its own point size, and the label has to close the gap that
 * leaves or the two read as separate ideas rather than as one phrase.
 */
const COUNTER_LABEL_TOP = -20;

/**
 * The bullet, drawn at a size that cannot fit and allowed to run off the edge.
 *
 * A circle cropped by the screen reads as a piece of the station rather than as
 * an icon inside an app, which is the entire claim this zone is making.
 */
function BleedBullet({ line }: { line: LineID }): ReactElement {
  const size = StatementTheme.bullet.size;
  const glyph = Math.round(size * StatementTheme.bullet.glyphRatio);

  return (
    <View
      style={[styles.graphic, { right: -StatementTheme.bullet.overhang }]}
      accessibilityElementsHidden
      pointerEvents="none"
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: LINE_TEXT_COLORS[line],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontSize: glyph,
            fontWeight: '800',
            letterSpacing: -6,
            includeFontPadding: false,
            color: LINE_COLORS[line],
            // Pulls the numeral back into the visible half of the circle.
            marginLeft: -StatementTheme.bullet.overhang / 2,
          }}
        >
          {line}
        </Text>
      </View>
    </View>
  );
}

/**
 * The same idea for the surfacing card: the arrowhead off an EXIT plate, blown
 * up until it is architecture. Up is the only direction that matters here.
 */
function BleedExit({ ink }: { ink: string }): ReactElement {
  return (
    <View style={[styles.graphic, { right: -18 }]} accessibilityElementsHidden pointerEvents="none">
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 88,
          borderRightWidth: 88,
          borderBottomWidth: 122,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: ink,
        }}
      />
      <View style={{ width: 66, height: 62, backgroundColor: ink, alignSelf: 'center' }} />
    </View>
  );
}

/**
 * The black plate with white Helvetica on it, exactly as it hangs. Set in the
 * MTA's own vernacular rather than the line's colour because that is what the
 * traveller is about to look up and find; a plate tinted red would be a plate
 * that does not exist.
 */
function SignPlate({ legend, exit }: { legend: string; exit: boolean }): ReactElement {
  return (
    <View
      style={[styles.plate, exit ? styles.plateExit : null]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Sign reading ${legend}`}
    >
      {exit ? <View style={styles.plateUp} /> : null}
      <Text style={styles.plateText} numberOfLines={1} allowFontScaling={false}>
        {legend}
      </Text>
      {exit ? null : <View style={styles.plateArrow} />}
    </View>
  );
}

/**
 * The trains that share this platform, drawn hollow.
 *
 * They are never hidden. Someone standing on a shared platform will watch three
 * trains they must not board pull in, and an interface showing only their line
 * turns each of those arrivals into a moment of doubt. Named and outlined, each
 * arrival becomes a confirmation instead.
 */
function GhostRow({
  ghosts,
  line,
  ink,
  held,
}: {
  ghosts: readonly LineID[];
  line: LineID;
  ink: string;
  held: number;
}): ReactElement {
  const ambiguous = colourIsAmbiguous(line, ghosts);

  return (
    <View style={styles.ghostRow}>
      {ghosts.map((ghost) => (
        <View key={ghost} style={[styles.ghost, { borderColor: ink, opacity: held }]}>
          <Text style={[styles.ghostGlyph, { color: ink }]} allowFontScaling={false}>
            {ghost}
          </Text>
        </View>
      ))}
      <Text style={[styles.ghostText, { color: ink }]} allowFontScaling={false}>
        {ambiguous ? 'SAME COLOUR AS YOURS.\nREAD THE NUMBER.' : 'ALSO STOP HERE.\nLET THEM PASS.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    // Carries the status-bar inset itself, so the colour reaches the ceiling.
    paddingTop: STATEMENT_TOP,
    // The rail is pinned to the bottom edge; this is the room it needs.
    paddingBottom: 66,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: StatementTheme.type.kicker,
  graphic: {
    position: 'absolute',
    top: 112,
  },
  counter: {
    ...StatementTheme.type.counter,
    includeFontPadding: false,
    marginTop: 12,
  },
  headline: {
    fontWeight: '800',
    includeFontPadding: false,
  },
  sub: {
    ...StatementTheme.type.sub,
    marginTop: 24,
  },
  name: {
    ...StatementTheme.type.name,
    marginTop: 2,
  },
  plate: {
    backgroundColor: PaperTheme.colors.plate,
    marginTop: 24,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plateExit: {
    justifyContent: 'flex-start',
  },
  plateText: {
    color: PaperTheme.colors.plateInk,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  plateArrow: {
    width: 0,
    height: 0,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 17,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: PaperTheme.colors.plateInk,
    marginLeft: 12,
  },
  plateUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderBottomWidth: 15,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: PaperTheme.colors.plateInk,
    marginRight: 14,
  },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  ghost: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ghostGlyph: {
    fontSize: 19,
    fontWeight: '800',
    includeFontPadding: false,
  },
  ghostText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    lineHeight: 17,
    marginLeft: 10,
    flexShrink: 1,
  },
  footnote: {
    marginTop: 22,
  },
  footnoteRule: {
    height: 2,
    opacity: 0.35,
    marginBottom: 14,
  },
  footnoteValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  warning: {
    backgroundColor: PaperTheme.colors.plate,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  warningCaption: {
    color: '#FF6B5E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 5,
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  rail: {
    position: 'absolute',
    bottom: 32,
  },
});
