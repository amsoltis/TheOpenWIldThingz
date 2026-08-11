import type { ReactElement } from 'react';
import { View } from 'react-native';
import type { LineID, RouteCard } from '@streetlevel/shared';

import { DirectionalSign } from '../DirectionalSign';
import { PaperList } from '../PaperList';
import { PaperSection } from '../PaperSection';
import { isSignAnchor, lineFromInstruction, overheadSignLegends } from '../../lib/cardFacts';

interface MezzanineTransitBodyProps {
  card: RouteCard;
  line: LineID | null;
}

/**
 * Inside the station, between the turnstile and the platform.
 *
 * This is the only phase where the traveller is not looking at their phone —
 * they are walking with their head up, scanning a ceiling full of black plates.
 * So the card renders the plate they are hunting instead of describing it, and
 * a black plate is the one thing that looks more like itself on paper than it
 * ever did on a dark screen. The match then happens the way it happens in the
 * real world: a shape recognised at ten metres, with the reading done
 * afterwards to confirm.
 */
export function MezzanineTransitBody({ card, line }: MezzanineTransitBodyProps): ReactElement {
  const signLine = line ?? lineFromInstruction(card.primaryInstructionMarkdown);
  const legends = overheadSignLegends(card.visualAnchors);
  const rest = card.visualAnchors.filter((anchor) => !isSignAnchor(anchor));

  return (
    <View>
      <PaperSection label="FIND THIS ON THE CEILING">
        <DirectionalSign
          lines={signLine ? [signLine] : []}
          legends={legends}
          banner="TO THE PLATFORM"
        />
      </PaperSection>

      {rest.length > 0 ? (
        <PaperSection label="ALSO TRUE HERE">
          <PaperList rows={rest.map((text) => ({ text }))} />
        </PaperSection>
      ) : null}
    </View>
  );
}
