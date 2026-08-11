import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import type { LineID, StreetEntranceNode } from '@streetlevel/shared';
import {
  LINE_COLORS,
  LINE_TEXT_COLORS,
  PaperTheme,
  StatementTheme,
  statementFontSize,
} from '@streetlevel/shared';

import { LineBullet } from '../components/LineBullet';
import { PaperNotice } from '../components/PaperNotice';
import { PaperSection } from '../components/PaperSection';
import { PrimaryButton } from '../components/PrimaryButton';
import { StreetGlobe } from '../components/StreetGlobe';
import { linesServedFrom, mentionsStreetGlobe, stationNameFrom, stripStationSuffix } from '../lib/cardFacts';
import { STATEMENT_TOP } from '../lib/insets';
import {
  ALL_CORNER_CODES,
  cornerDescription,
  cornerPlainName,
  splitIntersection,
} from '../lib/streetGeometry';
import type { CornerCode } from '../lib/streetGeometry';

interface EntranceLockScreenProps {
  entrance: StreetEntranceNode;
  activeLineId: LineID | null;
  legLabel: string;
  onConfirm: () => void;
  onNeedHelp: () => void;
}

/**
 * The Entrance Lock.
 *
 * No route card is reachable until the traveller confirms which corner they are
 * standing on, and that gate exists because of one specific failure: NYC
 * complexes have entrances on all four corners feeding different platforms with
 * no connection behind the turnstile. Walk down the wrong staircase and you are
 * not "slightly off" — you are inside a maze, on the wrong side of a fare gate,
 * with no signal, holding directions that assume you are somewhere else.
 *
 * It is the first screen of the trip, so it is also where the traveller learns
 * the grammar they will use for the next forty minutes: colour states, paper
 * enumerates. Everything under the statement is drawn to be matched against the
 * street rather than read — a plan of the intersection, the corner picked out
 * in the colour of the line, the one landmark the surveyor could see from it.
 */
export function EntranceLockScreen({
  entrance,
  activeLineId,
  legLabel,
  onConfirm,
  onNeedHelp,
}: EntranceLockScreenProps): ReactElement {
  const { primaryStreet, crossStreet } = splitIntersection(entrance.streetIntersectionText);
  const field = activeLineId ? LINE_COLORS[activeLineId] : PaperTheme.colors.ink;
  const ink = activeLineId ? LINE_TEXT_COLORS[activeLineId] : PaperTheme.colors.paper;
  const target = entrance.geographicCornerCode;

  /**
   * Only draw the intersection when we actually know two streets.
   *
   * Where the station has not been surveyed the compiler sends a station name
   * rather than a crossing, and the corner code is the side the traveller
   * approaches from — not a surveyed staircase position. Rendering the
   * four-corner plan anyway would put a confident marker on a corner nobody
   * has checked, which is the exact mistake this screen exists to prevent.
   */
  const hasIntersection = crossStreet.length > 0;
  const stationName =
    stationNameFrom([entrance.visualLandmarkCue]) ?? stripStationSuffix(primaryStreet);
  const linesServed = linesServedFrom([entrance.visualLandmarkCue]);

  const headline = hasIntersection ? ['STAND', 'HERE'] : ['FIND', 'THIS'];
  const headlineSize = statementFontSize(headline, STATEMENT_COLUMN);

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
      <View style={[styles.statement, { backgroundColor: field }]}>
        <Text style={[styles.kicker, { color: ink }]} allowFontScaling={false}>
          {legLabel} · BEFORE YOU GO DOWN
        </Text>

        {activeLineId ? (
          <View style={styles.statementBullet} accessibilityElementsHidden pointerEvents="none">
            <View style={[styles.bigBullet, { backgroundColor: ink }]}>
              <Text style={[styles.bigBulletGlyph, { color: field }]} allowFontScaling={false}>
                {activeLineId}
              </Text>
            </View>
          </View>
        ) : null}

        <Text
          style={[
            styles.headline,
            {
              color: ink,
              fontSize: headlineSize,
              lineHeight: Math.round(headlineSize * StatementTheme.type.headlineLeading),
              letterSpacing:
                StatementTheme.type.headlineTracking * (headlineSize / StatementTheme.type.headlineMax),
            },
          ]}
          allowFontScaling={false}
        >
          {headline.join('\n')}
        </Text>

        <Text style={[styles.statementSub, { color: ink }]}>
          {hasIntersection ? 'on the corner of' : 'the station you want is'}
        </Text>
        <Text style={[styles.statementName, { color: ink }]} numberOfLines={3}>
          {hasIntersection ? entrance.streetIntersectionText : stationName}
        </Text>
      </View>

      <View style={styles.paper}>
        <View style={styles.headRule} />

        {hasIntersection ? (
          <>
            <View
              style={styles.diagram}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Plan of ${entrance.streetIntersectionText}. Your entrance is on the ${cornerPlainName(
                target,
              )} corner.`}
            >
              <Text style={styles.compass} allowFontScaling={false}>
                N ↑
              </Text>

              <View style={styles.streetHorizontal}>
                <Text style={styles.streetLabel} numberOfLines={1} allowFontScaling={false}>
                  {primaryStreet}
                </Text>
              </View>

              <View style={styles.streetVertical}>
                <Text style={styles.streetLabelRotated} numberOfLines={1} allowFontScaling={false}>
                  {crossStreet}
                </Text>
              </View>

              {ALL_CORNER_CODES.map((code) => {
                const isTarget = code === target;
                return (
                  <View
                    key={code}
                    style={[
                      styles.corner,
                      CORNER_POSITIONS[code],
                      isTarget ? { backgroundColor: field, borderColor: field } : null,
                    ]}
                  >
                    {isTarget ? (
                      <View style={[styles.marker, { backgroundColor: ink }]} />
                    ) : (
                      <Text style={styles.cornerCode} allowFontScaling={false}>
                        {code}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={styles.cornerRow}>
              {activeLineId ? <LineBullet line={activeLineId} size={42} /> : null}
              <Text style={styles.cornerSentence}>
                {cornerDescription(target, entrance.streetIntersectionText)}
              </Text>
            </View>
          </>
        ) : (
          /* The unsurveyed case used to open with a grey box apologising for
             what we do not know. That is the wrong first impression for a
             screen whose whole job is to make someone confident enough to walk
             down a staircase, and it buried the part we *are* certain about.
             The station name is now four feet tall in the colour above, so what
             is left down here is the thing that confirms it — the row of
             bullets printed on the sign — and the caveat, one rule below. */
          <PaperSection label="THE SIGN WILL LIST THESE" flush>
            {linesServed.length > 0 ? (
              <View style={styles.servedRow}>
                {linesServed.map((served) => (
                  <View key={served} style={styles.servedSlot}>
                    <LineBullet line={served} size={44} />
                  </View>
                ))}
              </View>
            ) : null}
            {/* Only when the compiler sent no warning of its own. Where it did,
                that sentence is already printed below and says the same thing —
                and a stranger cannot tell whether a repeated caveat is a second,
                different problem. */}
            {entrance.avoidanceWarningText ? null : (
              <Text style={styles.caveat}>
                We have not surveyed the individual staircases here, so any entrance signed for this
                station will do.
              </Text>
            )}
          </PaperSection>
        )}

        <PaperSection label="YOU SHOULD BE ABLE TO SEE">
          <View style={styles.landmarkRow}>
            {mentionsStreetGlobe(entrance.visualLandmarkCue) ? <StreetGlobe /> : null}
            <Text style={styles.landmark}>{entrance.visualLandmarkCue}</Text>
          </View>
        </PaperSection>

        {entrance.avoidanceWarningText ? (
          <View style={styles.warning}>
            <PaperNotice caption="DO NOT" text={entrance.avoidanceWarningText} />
          </View>
        ) : null}

        <Text style={styles.why}>
          Why we ask: {hasIntersection ? 'this intersection has' : 'big stations have'} staircases on
          more than one corner, and underground they do not always connect. Going down the wrong one
          puts you behind a fare gate on the wrong platform, with no signal and no way through except
          back up to the street. Thirty seconds of checking here saves twenty minutes down there.
        </Text>

        <PrimaryButton
          label="I'm at this corner"
          onPress={onConfirm}
          {...(activeLineId ? { tintColor: field, tintInk: ink } : {})}
          accessibilityHint="Unlocks your step-by-step directions."
          style={styles.confirm}
        />

        <PrimaryButton
          label="I can't find this corner"
          onPress={onNeedHelp}
          tone="quiet"
          accessibilityHint="Describe what you can see and we will work out where you are."
          style={styles.help}
        />
      </View>
    </ScrollView>
  );
}

/** Matches the card's statement column so both screens set at the same size. */
const STATEMENT_COLUMN = 232;

const CORNER_POSITIONS: Record<CornerCode, ViewStyle> = {
  NW: { top: '4%', left: '4%' },
  NE: { top: '4%', right: '4%' },
  SW: { bottom: '4%', left: '4%' },
  SE: { bottom: '4%', right: '4%' },
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PaperTheme.colors.paper,
  },
  statement: {
    paddingHorizontal: StatementTheme.margin,
    paddingTop: STATEMENT_TOP,
    paddingBottom: 38,
    overflow: 'hidden',
  },
  kicker: StatementTheme.type.kicker,
  statementBullet: {
    position: 'absolute',
    right: -StatementTheme.bullet.overhang,
    top: 96,
  },
  bigBullet: {
    width: StatementTheme.bullet.size,
    height: StatementTheme.bullet.size,
    borderRadius: StatementTheme.bullet.size / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBulletGlyph: {
    fontSize: Math.round(StatementTheme.bullet.size * StatementTheme.bullet.glyphRatio),
    fontWeight: '800',
    letterSpacing: -6,
    includeFontPadding: false,
    marginLeft: -StatementTheme.bullet.overhang / 2,
  },
  headline: {
    fontWeight: '800',
    includeFontPadding: false,
    marginTop: 62,
    maxWidth: STATEMENT_COLUMN + 28,
  },
  statementSub: {
    ...StatementTheme.type.sub,
    marginTop: 22,
    opacity: 0.85,
  },
  statementName: {
    ...StatementTheme.type.name,
    fontSize: 30,
    lineHeight: 34,
    marginTop: 2,
  },
  paper: {
    paddingHorizontal: PaperTheme.margin,
    paddingBottom: 56,
  },
  headRule: {
    height: PaperTheme.rules.head,
    backgroundColor: PaperTheme.colors.ink,
    marginTop: 26,
    marginBottom: 22,
  },
  diagram: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: PaperTheme.colors.paperShade,
    overflow: 'hidden',
  },
  compass: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.inkMuted,
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 3,
  },
  streetHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
    height: '20%',
    backgroundColor: PaperTheme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streetVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '40%',
    width: '20%',
    backgroundColor: PaperTheme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streetLabel: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.paper,
    paddingHorizontal: 4,
  },
  streetLabelRotated: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.paper,
    transform: [{ rotate: '-90deg' }],
    width: 160,
    textAlign: 'center',
  },
  corner: {
    position: 'absolute',
    width: '34%',
    height: '34%',
    borderWidth: 2,
    borderColor: PaperTheme.colors.ruleStrong,
    backgroundColor: PaperTheme.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cornerCode: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.inkMuted,
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 999,
  },
  servedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  servedSlot: {
    marginRight: 8,
    marginBottom: 6,
  },
  caveat: {
    ...PaperTheme.type.aside,
    color: PaperTheme.colors.inkMuted,
    marginTop: 14,
  },
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  cornerSentence: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.ink,
    flexShrink: 1,
    marginLeft: 16,
  },
  landmarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  landmark: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.ink,
    flexShrink: 1,
    marginLeft: 16,
  },
  warning: {
    marginTop: 24,
  },
  why: {
    ...PaperTheme.type.aside,
    color: PaperTheme.colors.inkMuted,
    marginTop: 24,
  },
  confirm: {
    marginTop: 30,
  },
  help: {
    marginTop: 14,
  },
});
