import type { ReactElement } from 'react';
import { View } from 'react-native';
import type { RouteCard } from '@streetlevel/shared';

import { PaperList } from '../PaperList';
import { PaperSection } from '../PaperSection';
import { PeripheralLineRow } from '../PeripheralLineRow';
import { PlatformPositionStrip } from '../PlatformPositionStrip';
import { isPeripheralAnchor } from '../../lib/cardFacts';

interface PlatformWaitBodyProps {
  card: RouteCard;
}

/**
 * Standing on the platform, deciding which train to get on.
 *
 * Two questions, in this order, and nothing else: is this my train, and where
 * on the platform do I stand. The statement above already answered the first at
 * the size of a room; what is left down here is the sentence that makes the
 * answer defensible when a train the traveller must ignore pulls in, and the
 * diagram that says where to be standing when theirs does.
 */
export function PlatformWaitBody({ card }: PlatformWaitBodyProps): ReactElement {
  const focus = card.targetLineFocus;
  const rest = card.visualAnchors.filter((anchor) => !isPeripheralAnchor(anchor));

  return (
    <View>
      {focus ? <PeripheralLineRow focus={focus} /> : null}
      {focus ? <PlatformPositionStrip focus={focus} /> : null}

      {rest.length > 0 ? (
        <PaperSection label="CONFIRM BEFORE YOU BOARD">
          <PaperList rows={rest.map((text) => ({ text }))} />
        </PaperSection>
      ) : null}
    </View>
  );
}
