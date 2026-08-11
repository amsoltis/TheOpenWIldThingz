import { useEffect, useReducer, useState } from 'react';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { PacketRequest, RecoveryRequest } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { requestPacket, requestRecovery } from './src/api/client';
import { PacketValidationError, isPaywallError, travellerFacingMessage } from './src/api/errors';
import { PrimaryButton } from './src/components/PrimaryButton';
import { CardDeckScreen } from './src/screens/CardDeckScreen';
import { EntranceLockScreen } from './src/screens/EntranceLockScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { PlanTripScreen } from './src/screens/PlanTripScreen';
import { RecoveryScreen } from './src/screens/RecoveryScreen';
import { resolveFreeAllowance } from './src/lib/config';
import { BOTTOM_INSET, TOP_INSET } from './src/lib/insets';
import { legDurationText, orderedCards, primaryLineOf } from './src/lib/journey';
import {
  appReducer,
  activeCardIndex,
  activeLegOf,
  cardNext,
  cardPrev,
  billingUpdated,
  entranceConfirmed,
  errorDismissed,
  initialAppState,
  legSelected,
  packetReceived,
  packetRequested,
  packetRestored,
  paywallDismissed,
  paywallRaised,
  recoveryCleared,
  recoveryDismissed,
  recoveryOpened,
  recoveryRequested,
  recoveryResolved,
  requestFailed,
  tripReset,
} from './src/state/appMachine';
import type { LegKey } from './src/state/appMachine';
import { getCachedLeg, listPacketSummaries, primeMostRecent, putPacket } from './src/storage/packetCache';
import { loadBillingSnapshot, saveBillingSnapshot } from './src/storage/db';

/**
 * The whole app is one reducer and five screens. There is no router because the
 * product is a single linear deck with three interruptions, and a navigation
 * stack would let a traveller end up somewhere with a back button they cannot
 * see and no idea which trip they are looking at.
 */
export default function App(): ReactElement {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [savedTripLabel, setSavedTripLabel] = useState<string | null>(null);
  const [downloadedTripCount, setDownloadedTripCount] = useState(0);
  const freeAllowance = resolveFreeAllowance();

  // Cold start reads only from disk. The planner must be usable — and a
  // previously downloaded trip openable — with the phone in airplane mode.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [billing, summaries, restored] = await Promise.all([
          loadBillingSnapshot(),
          listPacketSummaries(),
          primeMostRecent(),
        ]);
        if (cancelled) return;
        if (billing) dispatch(billingUpdated(billing));
        setDownloadedTripCount(summaries.length);
        setSavedTripLabel(restored ? restored.outboundJourney.destinationAddress : null);
      } catch (error) {
        if (!cancelled) dispatch(requestFailed(travellerFacingMessage(error)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLibrary = async (): Promise<void> => {
    const summaries = await listPacketSummaries();
    setDownloadedTripCount(summaries.length);
    setSavedTripLabel(summaries[0]?.destinationAddress ?? null);
  };

  const handlePlanTrip = async (request: PacketRequest): Promise<void> => {
    dispatch(packetRequested(request.destinationAddress));
    try {
      const { packet, billing } = await requestPacket(request);
      await putPacket(packet);
      if (billing) await saveBillingSnapshot(billing);
      dispatch(packetReceived(packet, billing));
      await refreshLibrary();
    } catch (error) {
      if (isPaywallError(error)) {
        dispatch(paywallRaised(error.response));
        return;
      }
      if (error instanceof PacketValidationError) {
        // Loud in the log, calm on screen. These failures are shaping bugs we
        // need the detail of, and the traveller needs none of it.
        console.warn('[streetlevel] rejected an invalid packet', error.failures);
      }
      dispatch(requestFailed(travellerFacingMessage(error)));
    }
  };

  const handleOpenSavedTrip = async (): Promise<void> => {
    const restored = await primeMostRecent();
    if (restored) dispatch(packetRestored(restored));
  };

  const handleRecover = async (surroundingsDescription: string): Promise<void> => {
    dispatch(recoveryRequested());
    const request: RecoveryRequest = { surroundingsDescription };
    if (state.packet) request.activePacketId = state.packet.packetId;
    if (state.intendedDestinationAddress) {
      request.intendedDestinationAddress = state.intendedDestinationAddress;
    }
    try {
      dispatch(recoveryResolved(await requestRecovery(request)));
    } catch (error) {
      if (isPaywallError(error)) {
        dispatch(paywallRaised(error.response));
        return;
      }
      dispatch(requestFailed(travellerFacingMessage(error)));
    }
  };

  const handleSelectLeg = (leg: LegKey): void => {
    dispatch(legSelected(leg));
  };

  // Cache first: both legs were compiled together and are resident in memory,
  // which is what makes the outbound/return toggle instant with no spinner.
  const cachedLeg = state.packet ? getCachedLeg(state.packet.packetId, state.activeLeg) : null;
  const leg = cachedLeg ?? activeLegOf(state);
  const cards = orderedCards(leg);
  const activeLine = primaryLineOf(leg);

  if (state.screen === 'PAYWALL' && state.paywall) {
    return (
      <View style={styles.bleed}>
        <StatusBar style="light" />
        <PaywallScreen
          response={state.paywall}
          intendedDestination={state.intendedDestinationAddress}
          freeAllowance={freeAllowance}
          downloadedTripCount={downloadedTripCount}
          onDismiss={() => dispatch(paywallDismissed())}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {state.screen === 'PLANNING' ? (
        <PlanTripScreen
          billing={state.billing}
          isBusy={state.isBusy}
          errorMessage={state.errorMessage}
          savedTripLabel={savedTripLabel}
          onSubmit={(request) => void handlePlanTrip(request)}
          onOpenSavedTrip={() => void handleOpenSavedTrip()}
          onDismissError={() => dispatch(errorDismissed())}
        />
      ) : null}

      {state.screen === 'ENTRANCE_LOCK' && leg ? (
        <EntranceLockScreen
          entrance={leg.initialStreetEntrance}
          activeLineId={activeLine}
          legLabel={state.activeLeg === 'outbound' ? 'HEADING OUT' : 'HEADING HOME'}
          onConfirm={() => dispatch(entranceConfirmed())}
          onNeedHelp={() => dispatch(recoveryOpened())}
        />
      ) : null}

      {state.screen === 'NAVIGATING' && leg ? (
        <CardDeckScreen
          cards={cards}
          index={Math.min(activeCardIndex(state), Math.max(cards.length - 1, 0))}
          activeLeg={state.activeLeg}
          destinationLabel={leg.destinationAddress}
          durationLabel={legDurationText(leg)}
          onNext={() => dispatch(cardNext())}
          onPrev={() => dispatch(cardPrev())}
          onSelectLeg={handleSelectLeg}
          onNeedHelp={() => dispatch(recoveryOpened())}
        />
      ) : null}

      {state.screen === 'RECOVERY' ? (
        <RecoveryScreen
          session={state.recovery}
          isBusy={state.isBusy}
          errorMessage={state.errorMessage}
          intendedDestination={state.intendedDestinationAddress}
          onSubmit={(description) => void handleRecover(description)}
          onNext={() => dispatch(cardNext())}
          onPrev={() => dispatch(cardPrev())}
          onTryAgain={() => dispatch(recoveryCleared())}
          onDismiss={() => dispatch(recoveryDismissed())}
        />
      ) : null}

      {/* A packet-less ENTRANCE_LOCK or NAVIGATING state should be unreachable,
          but a blank screen underground is unforgivable, so it says so. */}
      {(state.screen === 'ENTRANCE_LOCK' || state.screen === 'NAVIGATING') && !leg ? (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            This trip did not load. Plan it again — nothing you already downloaded has been lost.
          </Text>
          <PrimaryButton
            label="Back to planning"
            onPress={() => dispatch(tripReset())}
            style={styles.fallbackButton}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SubwayTheme.colors.backgroundDeep,
    paddingTop: TOP_INSET,
    paddingBottom: BOTTOM_INSET,
  },
  bleed: {
    flex: 1,
    backgroundColor: SubwayTheme.colors.backgroundDeep,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    padding: SubwayTheme.spacing.lg,
  },
  fallbackText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
  },
  fallbackButton: {
    marginTop: SubwayTheme.spacing.lg,
  },
});
