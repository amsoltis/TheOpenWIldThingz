/**
 * Renders the real screen components into phone-sized frames.
 *
 * These are the actual components the Expo client ships, imported unmodified,
 * fed real compiler output. The runtime underneath is react-native-web rather
 * than the native engine, so metrics and font rendering differ slightly from a
 * device — this shows what the interface *says* and how it is laid out, which
 * is the part worth reviewing before anyone has a build on a phone.
 *
 * Every phase gets a frame. The five phase layouts are the product's main
 * claim — that waiting on a platform and sitting on a train are different
 * moments — and a gallery that showed two of them would let the other three
 * rot unnoticed.
 */
import { createRoot } from 'react-dom/client';
import { View, Text, StyleSheet } from 'react-native';
import type { ReactElement, ReactNode } from 'react';

import type {
  LineID,
  PaywallExceptionResponse,
  PhaseType,
  RecoveryResponse,
  RouteCard,
  TransitPacket,
} from '@streetlevel/shared';
import { PaperTheme } from '@streetlevel/shared';

import { CardDeckScreen } from '../../mobile/src/screens/CardDeckScreen';
import { EntranceLockScreen } from '../../mobile/src/screens/EntranceLockScreen';
import { PaywallScreen } from '../../mobile/src/screens/PaywallScreen';
import { PlanTripScreen } from '../../mobile/src/screens/PlanTripScreen';
import { RecoveryScreen } from '../../mobile/src/screens/RecoveryScreen';
import { orderedCards, legDurationText, primaryLineOf } from '../../mobile/src/lib/journey';

import fixtures from './generated/fixtures.json';

const { packet, recovery, paywall } = fixtures as unknown as {
  packet: TransitPacket;
  recovery: RecoveryResponse;
  paywall: PaywallExceptionResponse;
};

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

const noop = () => {};

function Phone({ caption, children }: { caption: string; children: ReactNode }): ReactElement {
  return (
    <View style={styles.phoneColumn}>
      {/* react-native-web forwards dataSet as data-* attributes, which is how
          the screenshot script locates each frame to capture individually. */}
      <View style={styles.phone} dataSet={{ phone: 'true' }}>
        {children}
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

/**
 * The same screen at phone width but with the fold removed.
 *
 * A card is two zones and only the first fits on a phone; the enumeration below
 * it is reached by scrolling, which a screenshot cannot do. Reviewing the deck
 * from cropped frames alone means the stop ladder, the platform diagram and the
 * DO NOT block are never actually looked at — so these frames exist to make the
 * paper reviewable. The statement zone is capped in points, so what is shown
 * here is the real composition with more of the page visible, not a different
 * layout.
 */
function Unrolled({ caption, children }: { caption: string; children: ReactNode }): ReactElement {
  return (
    <View style={styles.phoneColumn}>
      <View style={[styles.phone, styles.unrolled]} dataSet={{ phone: 'true' }}>
        {children}
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const outbound = packet.outboundJourney;
const cards = orderedCards(outbound);
const returnCards = orderedCards(packet.returnJourney);

function phaseIndex(phase: PhaseType): number {
  const found = cards.findIndex((c) => c.phaseType === phase);
  return found === -1 ? 0 : found;
}

/**
 * The same deck, repainted onto the Broadway lines.
 *
 * Yellow is the only field in the system that takes black type — the MTA pairs
 * it that way on the physical bullet and `LINE_TEXT_COLORS` encodes it — so it
 * is the one case where a hardcoded white anywhere in the statement zone turns
 * a card into a blank screen. It also puts four same-coloured trains on one
 * platform, which is the worst case for the peripheral-dimming copy. Both
 * failures are invisible on the red fixture, so the gallery carries a yellow
 * frame permanently rather than trusting anyone to remember to check.
 */
function repaint(card: RouteCard, line: LineID, siblings: LineID[]): RouteCard {
  if (!card.targetLineFocus) return card;
  return {
    ...card,
    targetLineFocus: {
      ...card.targetLineFocus,
      activeLineId: line,
      coLocatedLinesToDim: siblings,
    },
  };
}

const yellowCards = cards.map((card) => repaint(card, 'N', ['Q', 'R', 'W']));

function deckProps(index: number, leg: 'outbound' | 'return' = 'outbound') {
  const journey = leg === 'outbound' ? outbound : packet.returnJourney;
  return {
    cards: leg === 'outbound' ? cards : returnCards,
    index,
    activeLeg: leg,
    destinationLabel: journey.destinationAddress,
    durationLabel: legDurationText(journey),
    onNext: noop,
    onPrev: noop,
    onSelectLeg: noop,
    onNeedHelp: noop,
  } as const;
}

function Gallery(): ReactElement {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Streetlevel — Times Square to the Brooklyn Botanic Garden</Text>
      <Text style={styles.subtitle}>
        Real components, real compiled packet. Outbound at 2pm, return at 1:30am.
      </Text>

      <View style={styles.row}>
        <Phone caption="1 · Entrance Lock — the corner, before anything is underground">
          <EntranceLockScreen
            entrance={outbound.initialStreetEntrance}
            activeLineId={primaryLineOf(outbound)}
            legLabel="HEADING OUT"
            onConfirm={noop}
            onNeedHelp={noop}
          />
        </Phone>

        <Phone caption="2 · Entrance approach — FIND THIS">
          <CardDeckScreen {...deckProps(phaseIndex('ENTRANCE_APPROACH'))} />
        </Phone>

        <Phone caption="3 · Mezzanine — THIS WAY, and the plate they are hunting">
          <CardDeckScreen {...deckProps(phaseIndex('MEZZANINE_TRANSIT'))} />
        </Phone>
      </View>

      <View style={styles.row}>
        <Phone caption="4 · Platform — WAIT HERE">
          <CardDeckScreen {...deckProps(phaseIndex('PLATFORM_WAIT'))} />
        </Phone>

        <Phone caption="5 · On the train — the count, then the stops">
          <CardDeckScreen {...deckProps(phaseIndex('ON_TRAIN'))} />
        </Phone>

        <Phone caption="6 · Surfacing — UP AND OUT, and the walk that follows">
          <CardDeckScreen {...deckProps(phaseIndex('EXIT_SURFACING'))} />
        </Phone>
      </View>

      <View style={styles.row}>
        {/* The yellow case. Black ink on the field, black ink on the bullet,
            black ink on the GET OFF HERE flag — all of it from LINE_TEXT_COLORS
            rather than assumed. */}
        <Phone caption="7 · Broadway yellow — the only field that takes black type">
          <CardDeckScreen
            {...deckProps(phaseIndex('PLATFORM_WAIT'))}
            cards={yellowCards}
          />
        </Phone>

        <Phone caption="8 · Broadway yellow, on the train — flag and ladder">
          <CardDeckScreen {...deckProps(phaseIndex('ON_TRAIN'))} cards={yellowCards} />
        </Phone>

        <Phone caption="9 · Return leg — the divergence warning">
          <CardDeckScreen {...deckProps(0, 'return')} />
        </Phone>
      </View>

      <View style={styles.row}>
        <Phone caption="10 · I Messed Up — resolved, and a two-train ribbon">
          <RecoveryScreen
            session={{ response: recovery, cardIndex: 2 }}
            isBusy={false}
            errorMessage={null}
            intendedDestination="The Met"
            onSubmit={noop}
            onNext={noop}
            onPrev={noop}
            onTryAgain={noop}
            onDismiss={noop}
          />
        </Phone>

        <Phone caption="11 · Paywall after three free trips">
          <PaywallScreen
            response={paywall}
            intendedDestination="the Morgan Library"
            freeAllowance={3}
            downloadedTripCount={3}
            onDismiss={noop}
          />
        </Phone>

        <Phone caption="12 · The front door, before any trip exists">
          <PlanTripScreen
            billing={null}
            isBusy={false}
            errorMessage={null}
            savedTripLabel="Brooklyn Botanic Garden"
            onSubmit={noop}
            onOpenSavedTrip={noop}
            onDismissError={noop}
          />
        </Phone>
      </View>

      <View style={styles.row}>
        <Unrolled caption="14 · The platform card, unrolled — the whole paper zone">
          <CardDeckScreen {...deckProps(phaseIndex('PLATFORM_WAIT'))} />
        </Unrolled>

        <Unrolled caption="15 · The train card, unrolled — every stop, in order">
          <CardDeckScreen {...deckProps(phaseIndex('ON_TRAIN'))} />
        </Unrolled>

        <Unrolled caption="16 · Surfacing, unrolled — the walk and the trip band">
          <CardDeckScreen {...deckProps(phaseIndex('EXIT_SURFACING'))} />
        </Unrolled>
      </View>

      <View style={styles.row}>
        {/* The moment before anything is known. Worth a frame of its own: this
            is the screen someone reaches while genuinely lost, and its tone is
            the product's whole argument for being trusted underground. */}
        <Phone caption="13 · I Messed Up — asking, before any guess is made">
          <RecoveryScreen
            session={null}
            isBusy={false}
            errorMessage={null}
            intendedDestination="The Met"
            onSubmit={noop}
            onNext={noop}
            onPrev={noop}
            onTryAgain={noop}
            onDismiss={noop}
          />
        </Phone>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#1A1815',
    padding: 32,
  },
  title: {
    color: PaperTheme.colors.paper,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(242,238,228,0.6)',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 28,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 28,
  },
  phoneColumn: {
    marginRight: 28,
    width: PHONE_WIDTH,
  },
  phone: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    overflow: 'hidden',
    borderRadius: 34,
    backgroundColor: PaperTheme.colors.paper,
  },
  unrolled: {
    height: 2100,
  },
  caption: {
    color: 'rgba(242,238,228,0.6)',
    fontSize: 14,
    marginTop: 10,
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('no #root');
createRoot(container).render(<Gallery />);
