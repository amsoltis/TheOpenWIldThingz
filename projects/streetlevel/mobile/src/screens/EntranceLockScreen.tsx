import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import type { LineID, StreetEntranceNode } from '@streetlevel/shared';
import { LINE_COLORS, SubwayTheme } from '@streetlevel/shared';

import { LineBullet } from '../components/LineBullet';
import { PrimaryButton } from '../components/PrimaryButton';
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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.legLabel}>{legLabel}</Text>
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
        <View
          style={styles.stationPlate}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${primaryStreet}. The individual staircases here have not been surveyed.`}
        >
          <View style={[styles.stationPlateBar, { backgroundColor: accent }]} />
          <Text style={styles.stationPlateName}>{primaryStreet}</Text>
          {/* Kept to one line: the actionable version of this caveat is already
              in the avoidance box below, and saying it twice reads as noise. */}
          <Text style={styles.stationPlateNote}>
            We have not surveyed the individual staircases here.
          </Text>
        </View>
      )}

      <View style={styles.intersectionRow}>
        {activeLineId ? <LineBullet line={activeLineId} size={44} /> : null}
        <View style={styles.intersectionText}>
          <Text style={styles.intersection}>{entrance.streetIntersectionText}</Text>
          {hasIntersection ? (
            <Text style={styles.cornerSentence}>
              {cornerDescription(target, entrance.streetIntersectionText)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionCaption}>YOU SHOULD BE ABLE TO SEE</Text>
        <Text style={styles.landmark}>{entrance.visualLandmarkCue}</Text>
      </View>

      {entrance.avoidanceWarningText ? (
        <View style={styles.warningBox} accessible accessibilityRole="alert">
          <Text style={styles.warningCaption}>DO NOT</Text>
          <Text style={styles.warningText}>{entrance.avoidanceWarningText}</Text>
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
    backgroundColor: SubwayTheme.colors.backgroundDark,
  },
  content: {
    padding: SubwayTheme.spacing.lg,
    paddingBottom: SubwayTheme.spacing.xxl,
  },
  legLabel: {
    ...SubwayTheme.typography.metaLabel,
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
    backgroundColor: SubwayTheme.colors.backgroundDark,
    borderWidth: 2,
    borderColor: SubwayTheme.colors.surfaceCard,
    overflow: 'hidden',
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
  stationPlate: {
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderRadius: SubwayTheme.radii.card,
    padding: SubwayTheme.spacing.lg,
    marginTop: SubwayTheme.spacing.lg,
  },
  stationPlateBar: {
    height: 6,
    borderRadius: 3,
    width: 64,
    marginBottom: SubwayTheme.spacing.md,
  },
  stationPlateName: {
    ...SubwayTheme.typography.macroActionTitle,
    fontSize: 26,
    lineHeight: 32,
    color: SubwayTheme.colors.textPrimary,
  },
  stationPlateNote: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.md,
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
  sectionCaption: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
    marginBottom: SubwayTheme.spacing.sm,
  },
  landmark: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textPrimary,
  },
  warningBox: {
    marginTop: SubwayTheme.spacing.lg,
    padding: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.button,
    borderWidth: 2,
    borderColor: SubwayTheme.colors.danger,
  },
  warningCaption: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.danger,
    marginBottom: SubwayTheme.spacing.xs,
  },
  warningText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.danger,
  },
  why: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.lg,
  },
  confirm: {
    marginTop: SubwayTheme.spacing.xl,
  },
  help: {
    marginTop: SubwayTheme.spacing.md,
  },
});
