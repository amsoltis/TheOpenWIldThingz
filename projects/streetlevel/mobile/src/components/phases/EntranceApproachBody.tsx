import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RouteCard } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { LookForList } from '../LookForList';
import { SectionCaption } from '../SectionCaption';
import { StreetGlobe } from '../StreetGlobe';
import { mentionsStreetGlobe, stationNameFrom } from '../../lib/cardFacts';

interface EntranceApproachBodyProps {
  card: RouteCard;
  accent: string | undefined;
}

/**
 * Street level, before anything is underground.
 *
 * At this moment the traveller is standing on a pavement comparing a phone
 * against a city. The only two things that help are the name bolted to the
 * building and the shape of the thing they are looking for, so the station
 * identity is the hero and the surveyor's landmark cue is given a plate of its
 * own rather than being demoted to a bullet in a list. Everything the card says
 * about *walking* is already in the instruction above; this is about arriving.
 */
export function EntranceApproachBody({ card, accent }: EntranceApproachBodyProps): ReactElement {
  const landmark = card.visualAnchors.find((anchor) => mentionsStreetGlobe(anchor));
  // The station-name anchor is already the hero above the instruction; leaving
  // it in the list underneath would have the card say the name three times.
  const named = card.visualAnchors.find(
    (anchor) => anchor !== landmark && stationNameFrom([anchor]) !== null,
  );
  const rest = card.visualAnchors.filter((anchor) => anchor !== landmark && anchor !== named);

  return (
    <View>
      {landmark ? (
        <View style={styles.section}>
          <SectionCaption label="AT STREET LEVEL" accent={accent} />
          <View style={styles.landmarkPlate}>
            <StreetGlobe />
            <Text style={styles.landmarkText}>{landmark}</Text>
          </View>
        </View>
      ) : null}

      <LookForList anchors={rest} accent={accent} label="ALSO CHECK" />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: SubwayTheme.spacing.md,
  },
  landmarkPlate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SubwayTheme.spacing.sm,
    padding: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.chip,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
  },
  landmarkText: {
    ...SubwayTheme.typography.bodyStrong,
    color: SubwayTheme.colors.textPrimary,
    flexShrink: 1,
    marginLeft: SubwayTheme.spacing.md,
  },
});
