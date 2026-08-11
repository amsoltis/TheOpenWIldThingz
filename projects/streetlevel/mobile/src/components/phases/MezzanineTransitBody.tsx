import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LineID, RouteCard } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { DirectionalSign } from '../DirectionalSign';
import { LookForList } from '../LookForList';
import { SectionCaption } from '../SectionCaption';
import { isSignAnchor, lineFromInstruction, overheadSignLegends } from '../../lib/cardFacts';

interface MezzanineTransitBodyProps {
  card: RouteCard;
  line: LineID | null;
  accent: string | undefined;
}

/**
 * Inside the station, between the turnstile and the platform.
 *
 * This is the only phase where the traveller is not looking at their phone —
 * they are walking with their head up, scanning a ceiling full of black plates.
 * So the card renders the plate they are hunting instead of describing it. The
 * match then happens the way it happens in the real world: a shape and a colour
 * recognised at ten metres, with the reading done afterwards to confirm.
 */
export function MezzanineTransitBody({ card, line, accent }: MezzanineTransitBodyProps): ReactElement {
  const signLine = line ?? lineFromInstruction(card.primaryInstructionMarkdown);
  const legends = overheadSignLegends(card.visualAnchors);
  const rest = card.visualAnchors.filter((anchor) => !isSignAnchor(anchor));

  return (
    <View>
      <View style={styles.section}>
        <SectionCaption label="FIND THIS ON THE CEILING" accent={accent} />
        <DirectionalSign
          lines={signLine ? [signLine] : []}
          legends={legends}
          banner="TO THE PLATFORM"
        />
      </View>

      <LookForList anchors={rest} accent={accent} label="ALSO TRUE HERE" />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: SubwayTheme.spacing.md,
  },
});
