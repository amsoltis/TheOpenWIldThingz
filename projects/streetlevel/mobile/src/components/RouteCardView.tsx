import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PhaseType, RouteCard } from '@streetlevel/shared';
import { LINE_COLORS, SubwayTheme } from '@streetlevel/shared';

import { MarkdownText } from './MarkdownText';
import { PeripheralLineRow } from './PeripheralLineRow';
import { PlatformPositionStrip } from './PlatformPositionStrip';

interface RouteCardViewProps {
  card: RouteCard;
  stepLabel: string;
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
 */
export function RouteCardView({ card, stepLabel }: RouteCardViewProps): ReactElement {
  const accent = card.targetLineFocus ? LINE_COLORS[card.targetLineFocus.activeLineId] : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.phase}>{PHASE_CAPTIONS[card.phaseType]}</Text>
        <Text style={styles.step}>{stepLabel}</Text>
      </View>
      {accent ? <View style={[styles.accentRule, { backgroundColor: accent }]} /> : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <MarkdownText source={card.primaryInstructionMarkdown} style={styles.instruction} />

        {card.visualAnchors.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionCaption}>LOOK FOR</Text>
            {card.visualAnchors.map((anchor, index) => (
              <View key={`${anchor}-${index}`} style={styles.anchorRow}>
                <Text style={styles.anchorMark} accessibilityElementsHidden>
                  ▸
                </Text>
                <Text style={styles.anchorText}>{anchor}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {card.targetLineFocus ? <PeripheralLineRow focus={card.targetLineFocus} /> : null}
        {card.targetLineFocus ? <PlatformPositionStrip focus={card.targetLineFocus} /> : null}

        {/* Danger colour, never merely bold: this is the "do not walk down those
            stairs" text, and it has to survive being read at a glance. */}
        {card.criticalAvoidanceNotes ? (
          <View style={styles.avoidanceBox} accessible accessibilityRole="alert">
            <Text style={styles.avoidanceCaption}>DO NOT</Text>
            <Text style={styles.avoidanceText}>{card.criticalAvoidanceNotes}</Text>
          </View>
        ) : null}

        {card.offlineSensorValidation ? (
          <Text style={styles.sensorText}>
            {card.offlineSensorValidation.expectedTunnelTransitCount} stop
            {card.offlineSensorValidation.expectedTunnelTransitCount === 1 ? '' : 's'} to go. The stop
            after this one is {card.offlineSensorValidation.expectedNextStationNodeName}.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderRadius: SubwayTheme.radii.card,
    padding: SubwayTheme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phase: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
  },
  step: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
  },
  accentRule: {
    height: 4,
    borderRadius: 2,
    marginTop: SubwayTheme.spacing.sm,
  },
  scroll: {
    flex: 1,
    marginTop: SubwayTheme.spacing.md,
  },
  scrollContent: {
    paddingBottom: SubwayTheme.spacing.lg,
  },
  instruction: {
    ...SubwayTheme.typography.macroActionTitle,
    color: SubwayTheme.colors.textPrimary,
  },
  section: {
    marginTop: SubwayTheme.spacing.lg,
  },
  sectionCaption: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.textSecondary,
    marginBottom: SubwayTheme.spacing.sm,
  },
  anchorRow: {
    flexDirection: 'row',
    marginBottom: SubwayTheme.spacing.sm,
  },
  anchorMark: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginRight: SubwayTheme.spacing.sm,
  },
  anchorText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textPrimary,
    flexShrink: 1,
  },
  avoidanceBox: {
    marginTop: SubwayTheme.spacing.lg,
    padding: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.button,
    borderWidth: 2,
    borderColor: SubwayTheme.colors.danger,
  },
  avoidanceCaption: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.danger,
    marginBottom: SubwayTheme.spacing.xs,
  },
  avoidanceText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.danger,
  },
  sensorText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.lg,
  },
});
