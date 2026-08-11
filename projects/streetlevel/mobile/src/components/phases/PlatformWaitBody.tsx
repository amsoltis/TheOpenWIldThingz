import type { ReactElement } from 'react';
import { View } from 'react-native';
import type { RouteCard } from '@streetlevel/shared';

import { LookForList } from '../LookForList';
import { PeripheralLineRow } from '../PeripheralLineRow';
import { PlatformPositionStrip } from '../PlatformPositionStrip';
import { isPeripheralAnchor } from '../../lib/cardFacts';

interface PlatformWaitBodyProps {
  card: RouteCard;
  accent: string | undefined;
}

/**
 * Standing on the platform, deciding which train to get on.
 *
 * Two questions, in this order, and nothing else: is this my train, and where
 * on the platform do I stand. The bullet answers the first at a size that can
 * be held up and compared against the sign above the track; the car strip
 * answers the second. Everything textual is pushed underneath both, because a
 * train is pulling in and there is no time to read.
 */
export function PlatformWaitBody({ card, accent }: PlatformWaitBodyProps): ReactElement {
  const focus = card.targetLineFocus;
  const rest = card.visualAnchors.filter((anchor) => !isPeripheralAnchor(anchor));

  return (
    <View>
      {focus ? <PeripheralLineRow focus={focus} /> : null}
      {focus ? <PlatformPositionStrip focus={focus} /> : null}
      <LookForList anchors={rest} accent={accent} label="CONFIRM BEFORE YOU BOARD" />
    </View>
  );
}
