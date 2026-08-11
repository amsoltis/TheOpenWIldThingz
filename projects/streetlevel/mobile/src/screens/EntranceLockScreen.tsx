import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import type { LineID, StreetEntranceNode } from '@streetlevel/shared';
import { LINE_COLORS, SubwayTheme } from '@streetlevel/shared';

import { AlertNote } from '../components/AlertNote';
import { LineBullet } from '../components/LineBullet';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionCaption } from '../components/SectionCaption';
import { StationPlate } from '../components/StationPlate';
import { StreetGlobe } from '../components/StreetGlobe';
import { linesServedFrom, mentionsStreetGlobe, stationNameFrom, stripStationSuffix } from '../lib/cardFacts';
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
 * Everything on this screen is therefore drawn to be matched against the street
 * rather than read: a plan of the intersection, the corner picked out in the
 * colour of the line, and the one landmark the surveyor could see from it.
 */
export function EntranceLockScreen({
  entrance,
  activeLineId,
  legLabel,
  onConfirm,
  onNeedHelp,
}: EntranceLockScreenProps): ReactElement {
  const { primaryStreet, crossStreet } = splitIntersection(entrance.streetIntersectionText);
  const accent = activeLineId ? LINE_COLORS[activeLineId] : SubwayTheme.colors.success;
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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.legLabel} allowFontScaling={false}>
        {legLabel}
      </Text>
      <Text style={styles.title}>
        {hasIntersection ? 'Stand on this corner first.' : 'Find this station first.'}
      </Text>

      {hasIntersection ? (
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
          {crossStreet.length > 0 ? (
            <Text style={styles.streetLabelRotated} numberOfLines={1} allowFontScaling={false}>
              {crossStreet}
            </Text>
          ) : null}
        </View>

        {ALL_CORNER_CODES.map((code) => {
          const isTarget = code === target;
          return (
            <View
              key={code}
              style={[
                styles.corner,
                CORNER_POSITIONS[code],
                isTarget ? { backgroundColor: accent, borderColor: SubwayTheme.colors.textPrimary } : null,
              ]}
            >
              {isTarget ? (
                <View style={styles.marker}>
                  <View style={[styles.markerDot, { backgroundColor: accent }]} />
                </View>
              ) : (
                <Text style={styles.cornerCode} allowFontScaling={false}>
                  {code}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      ) : (
        /* The unsurveyed case used to open with a grey box apologising for what
           we do not know. That is the wrong first impression for a screen whose
           whole job is to make someone confident enough to walk down a
           staircase — and it buried the part we *are* certain about. The name
           and the bullets lead; the caveat is still here, one rule below,
           where it belongs. */
        <StationPlate
          name={stationName}
          linesServed={linesServed}
          accentLine={activeLineId}
          eyebrow="THE STATION YOU ARE LOOKING FOR"
          note="We have not surveyed the individual staircases here."
        />
      )}

      {hasIntersection ? (
        <View style={styles.intersectionRow}>
          {activeLineId ? <LineBullet line={activeLineId} size={44} /> : null}
          <View style={styles.intersectionText}>
            <Text style={styles.intersection}>{entrance.streetIntersectionText}</Text>
            <Text style={styles.cornerSentence}>
              {cornerDescription(target, entrance.streetIntersectionText)}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionCaption label="YOU SHOULD BE ABLE TO SEE" accent={accent} />
        <View style={styles.landmarkPlate}>
          {mentionsStreetGlobe(entrance.visualLandmarkCue) ? <StreetGlobe /> : null}
          <Text style={styles.landmark}>{entrance.visualLandmarkCue}</Text>
        </View>
      </View>

      {entrance.avoidanceWarningText ? (
        <View style={styles.warning}>
          <AlertNote caption="DO NOT" text={entrance.avoidanceWarningText} />
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
        tintColor={accent}
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
    </ScrollView>
  );
}

const CORNER_POSITIONS: Record<CornerCode, ViewStyle> = {
  NW: { top: '4%', left: '4%' },
  NE: { top: '4%', right: '4%' },
  SW: { bottom: '4%', left: '4%' },
  SE: { bottom: '4%', right: '4%' },
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SubwayTheme.colors.backgroundDeep,
  },
  content: {
    padding: SubwayTheme.spacing.lg,
    paddingBottom: SubwayTheme.spacing.xxl,
  },
  legLabel: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.md,
  },
  title: {
    ...SubwayTheme.typography.macroActionTitle,
    color: SubwayTheme.colors.textPrimary,
    marginTop: SubwayTheme.spacing.sm,
    marginBottom: SubwayTheme.spacing.lg,
  },
  diagram: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: SubwayTheme.radii.card,
    backgroundColor: SubwayTheme.colors.surfaceInset,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
    overflow: 'hidden',
    boxShadow: SubwayTheme.elevation.card,
  },
  compass: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
    position: 'absolute',
    top: SubwayTheme.spacing.xs,
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
    backgroundColor: SubwayTheme.colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streetVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '40%',
    width: '20%',
    backgroundColor: SubwayTheme.colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streetLabel: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.backgroundDark,
    paddingHorizontal: SubwayTheme.spacing.xs,
  },
  streetLabelRotated: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.backgroundDark,
    transform: [{ rotate: '-90deg' }],
    width: 160,
    textAlign: 'center',
  },
  corner: {
    position: 'absolute',
    width: '34%',
    height: '34%',
    borderRadius: SubwayTheme.radii.button,
    borderWidth: 2,
    borderColor: SubwayTheme.colors.textSecondary,
    backgroundColor: SubwayTheme.colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cornerCode: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: SubwayTheme.radii.bullet,
    backgroundColor: SubwayTheme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 18,
    height: 18,
    borderRadius: SubwayTheme.radii.bullet,
  },
  intersectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SubwayTheme.spacing.lg,
  },
  intersectionText: {
    flex: 1,
    marginLeft: SubwayTheme.spacing.md,
  },
  intersection: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    color: SubwayTheme.colors.textPrimary,
  },
  cornerSentence: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.xs,
  },
  section: {
    marginTop: SubwayTheme.spacing.lg,
  },
  landmarkPlate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SubwayTheme.spacing.sm,
    padding: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.chip,
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
  },
  landmark: {
    ...SubwayTheme.typography.bodyStrong,
    color: SubwayTheme.colors.textPrimary,
    flexShrink: 1,
    marginLeft: SubwayTheme.spacing.md,
  },
  warning: {
    marginTop: SubwayTheme.spacing.lg,
  },
  why: {
    ...SubwayTheme.typography.supportBody,
    color: SubwayTheme.colors.textTertiary,
    marginTop: SubwayTheme.spacing.lg,
  },
  confirm: {
    marginTop: SubwayTheme.spacing.xl,
  },
  help: {
    marginTop: SubwayTheme.spacing.md,
  },
});
