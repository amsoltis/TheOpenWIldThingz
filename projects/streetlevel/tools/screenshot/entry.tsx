/**
 * Renders the real screen components into phone-sized frames.
 *
 * These are the actual components the Expo client ships, imported unmodified,
 * fed real compiler output. The runtime underneath is react-native-web rather
 * than the native engine, so metrics and font rendering differ slightly from a
 * device — this shows what the interface *says* and how it is laid out, which
 * is the part worth reviewing before anyone has a build on a phone.
 */
import { createRoot } from 'react-dom/client';
import { View, Text, StyleSheet } from 'react-native';
import type { ReactElement, ReactNode } from 'react';

import type {
  PaywallExceptionResponse,
  RecoveryResponse,
  TransitPacket,
} from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { CardDeckScreen } from '../../mobile/src/screens/CardDeckScreen';
import { EntranceLockScreen } from '../../mobile/src/screens/EntranceLockScreen';
import { PaywallScreen } from '../../mobile/src/screens/PaywallScreen';
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

const outbound = packet.outboundJourney;
const cards = orderedCards(outbound);
const platformIndex = cards.findIndex((c) => c.phaseType === 'PLATFORM_WAIT');
const onTrainIndex = cards.findIndex((c) => c.phaseType === 'ON_TRAIN');
const returnCards = orderedCards(packet.returnJourney);

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
        <Phone caption="1 · Entrance Lock — the gate before any card is visible">
          <EntranceLockScreen
            entrance={outbound.initialStreetEntrance}
            activeLineId={primaryLineOf(outbound)}
            legLabel="My Outbound Trip"
            onConfirm={noop}
            onNeedHelp={noop}
          />
        </Phone>

        <Phone caption="2 · Platform card — peripheral dimming">
          <CardDeckScreen {...deckProps(platformIndex === -1 ? 0 : platformIndex)} />
        </Phone>

        <Phone caption="3 · On the train — the wrong-direction check">
          <CardDeckScreen {...deckProps(onTrainIndex === -1 ? 0 : onTrainIndex)} />
        </Phone>
      </View>

      <View style={styles.row}>
        <Phone caption="4 · Return leg — the divergence warning">
          <CardDeckScreen {...deckProps(0, 'return')} />
        </Phone>

        <Phone caption="5 · I Messed Up — resolved from a wall sign">
          <RecoveryScreen
            session={{ response: recovery, cardIndex: 0 }}
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

        <Phone caption="6 · Paywall after three free trips">
          <PaywallScreen
            response={paywall}
            intendedDestination="the Morgan Library"
            freeAllowance={3}
            downloadedTripCount={3}
            onDismiss={noop}
          />
        </Phone>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#0A0A0A',
    padding: 32,
  },
  title: {
    color: SubwayTheme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: SubwayTheme.colors.textSecondary,
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
    borderWidth: 2,
    borderColor: '#2C2C2C',
    backgroundColor: SubwayTheme.colors.backgroundDark,
  },
  caption: {
    color: SubwayTheme.colors.textSecondary,
    fontSize: 14,
    marginTop: 10,
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('no #root');
createRoot(container).render(<Gallery />);
