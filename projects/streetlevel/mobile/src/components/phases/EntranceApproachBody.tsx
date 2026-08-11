import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RouteCard } from '@streetlevel/shared';
import { PaperTheme } from '@streetlevel/shared';

import { PaperList } from '../PaperList';
import { PaperSection } from '../PaperSection';
import { StreetGlobe } from '../StreetGlobe';
import { mentionsStreetGlobe, stationNameFrom } from '../../lib/cardFacts';

interface EntranceApproachBodyProps {
  card: RouteCard;
}

/**
 * Street level, before anything is underground.
 *
 * At this moment the traveller is standing on a pavement comparing a phone
 * against a city, and the only two things that help are the name bolted to the
 * building — already four feet tall in the statement above — and the shape of
 * the thing they are looking for. So the surveyor's landmark cue is drawn
 * rather than listed, and everything else becomes a short "also check".
 */
export function EntranceApproachBody({ card }: EntranceApproachBodyProps): ReactElement {
  const landmark = card.visualAnchors.find((anchor) => mentionsStreetGlobe(anchor));
  // The station-name anchor is already the statement; leaving it in the list
  // underneath would have the card say the name three times.
  const named = card.visualAnchors.find(
    (anchor) => anchor !== landmark && stationNameFrom([anchor]) !== null,
  );
  const rest = card.visualAnchors.filter((anchor) => anchor !== landmark && anchor !== named);

  return (
    <View>
      {landmark ? (
        <PaperSection label="AT STREET LEVEL">
          <View style={styles.landmarkRow}>
            <StreetGlobe />
            <Text style={styles.landmarkText}>{landmark}</Text>
          </View>
        </PaperSection>
      ) : null}

      {rest.length > 0 ? (
        <PaperSection label="ALSO CHECK">
          <PaperList rows={rest.map((text) => ({ text }))} />
        </PaperSection>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  landmarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  landmarkText: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.ink,
    flexShrink: 1,
    marginLeft: 16,
  },
});
