import { useState } from 'react';
import type { ReactElement } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Application from 'expo-application';
import type { PaywallExceptionResponse, PaywallSku } from '@streetlevel/shared';
import { PaperTheme, SubwayTheme } from '@streetlevel/shared';

import { PaperList } from '../components/PaperList';
import { PaperNotice } from '../components/PaperNotice';
import { PaperSection } from '../components/PaperSection';
import { PrimaryButton } from '../components/PrimaryButton';
import { TOP_INSET, BOTTOM_INSET } from '../lib/insets';
import {
  downloadedTripsReassurance,
  paywallHeadline,
  paywallSubline,
  serverMessageWorthShowing,
  splitTierDescription,
} from '../lib/paywallCopy';
import { storeName, storeProductUrl } from '../lib/storeLinks';

interface PaywallScreenProps {
  response: PaywallExceptionResponse;
  intendedDestination: string | null;
  freeAllowance: number;
  downloadedTripCount: number;
  onDismiss: () => void;
}

/**
 * Full-bleed on purpose. This is the one screen that is allowed to take the
 * whole display: a paywall squeezed into a card reads as an interruption to
 * dismiss, and this is a decision we want made deliberately, once.
 *
 * It opens by showing the three keys, spent. A sentence saying the allowance is
 * gone is an accusation; three little tickets with their stubs torn is a record
 * of three trips that worked, which is the actual argument for buying a fourth.
 * The pass is then drawn as a thing you get rather than as a row in a settings
 * list — on paper, a ticket is finally allowed to look like a ticket.
 */
export function PaywallScreen({
  response,
  intendedDestination,
  freeAllowance,
  downloadedTripCount,
  onDismiss,
}: PaywallScreenProps): ReactElement {
  const [linkError, setLinkError] = useState<string | null>(null);

  const headline = paywallHeadline(freeAllowance);
  const subline = paywallSubline(intendedDestination);
  const serverMessage = serverMessageWorthShowing(response.message, headline, subline);

  const openSku = (sku: PaywallSku): void => {
    const url = storeProductUrl(sku.platformSkuString, Application.applicationId, Platform.OS);
    Linking.openURL(url).catch(() => {
      setLinkError(`We could not open ${storeName(Platform.OS)}. Your downloaded trips still work.`);
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headRule} />
        <SpentKeys allowance={freeAllowance} />

        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subline}>{subline}</Text>

        {serverMessage ? <Text style={styles.serverMessage}>{serverMessage}</Text> : null}

        <PaperSection label="WHAT LIFETIME ACCESS GIVES YOU">
          <PaperList
            ordered={false}
            rows={[
              { text: 'Every trip compiled for both directions, before you go underground.' },
              { text: 'Street-corner entrance checks so you take the right staircase the first time.' },
              { text: 'The lost-and-found button, any time, anywhere on the system.' },
            ]}
          />
        </PaperSection>

        {response.targetSkus.length > 0 ? (
          <View style={styles.skus}>
            {response.targetSkus.map((sku, index) => (
              <SkuTicket
                key={sku.platformSkuString}
                sku={sku}
                emphasised={index === 0}
                onPress={() => openSku(sku)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.noSkus}>
            Purchasing is unavailable right now. Everything already on this phone still works.
          </Text>
        )}

        {linkError ? <Text style={styles.linkError}>{linkError}</Text> : null}

        {/* Stated plainly and never buried: paying unlocks new trips, it does
            not unlock the ones they already have. Holding a downloaded trip
            hostage underground would be indefensible. */}
        <View style={styles.keepBox}>
          <PaperNotice
            tone="success"
            caption="WHAT YOU ALREADY HAVE STAYS YOURS"
            text={downloadedTripsReassurance(downloadedTripCount)}
          />
        </View>

        <PrimaryButton
          label="Not now"
          onPress={onDismiss}
          tone="quiet"
          accessibilityHint="Returns to your downloaded trips."
          style={styles.dismiss}
        />
      </ScrollView>
    </View>
  );
}

/**
 * The free allowance, drawn as tickets with their stubs gone. Someone who has
 * used three keys has had three trips work; showing that is a better argument
 * than telling them they have run out.
 */
function SpentKeys({ allowance }: { allowance: number }): ReactElement | null {
  if (allowance <= 0) return null;
  const keys = Array.from({ length: Math.min(allowance, 6) }, (_, i) => i);

  return (
    <View
      style={styles.keys}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`All ${allowance} free navigation keys have been used.`}
    >
      {keys.map((key) => (
        <View key={key} style={styles.key}>
          <View style={styles.keyStub} />
          <View style={styles.keyBody}>
            <View style={styles.keyStripe} />
          </View>
          <View style={styles.keyStrike} />
        </View>
      ))}
      <Text style={styles.keysLabel} allowFontScaling={false}>
        ALL USED
      </Text>
    </View>
  );
}

interface SkuTicketProps {
  sku: PaywallSku;
  emphasised: boolean;
  onPress: () => void;
}

function SkuTicket({ sku, emphasised, onPress }: SkuTicketProps): ReactElement {
  const { name, detail } = splitTierDescription(sku.tierDescription);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${sku.tierDescription || 'Unlock'} for ${sku.localizedPriceText}`}
      accessibilityHint={`Opens ${storeName(Platform.OS)} to complete the purchase.`}
      style={({ pressed }) => [
        styles.ticket,
        emphasised ? styles.ticketEmphasised : styles.ticketPlain,
        pressed ? styles.ticketPressed : null,
      ]}
    >
      <View style={styles.ticketHead}>
        <View style={styles.ticketTitle}>
          <Text style={[styles.ticketName, emphasised ? styles.onInk : styles.onPaper]}>{name}</Text>
          {detail ? (
            <Text style={[styles.ticketDetail, emphasised ? styles.onInkMuted : styles.onPaperMuted]}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.price, emphasised ? styles.onInk : styles.onPaper]}>
          {sku.localizedPriceText}
        </Text>
      </View>

      {/* The perforation. It is the difference between a row in a list and a
          ticket you are about to be handed. */}
      <View style={styles.perforation} accessibilityElementsHidden>
        {Array.from({ length: 26 }, (_, i) => (
          <View
            key={i}
            style={[styles.perfDot, emphasised ? styles.perfOnInk : styles.perfOnPaper]}
          />
        ))}
      </View>

      {/* The store product id is plumbing. It was on screen; nobody buying a
          subway app needs to read a reverse-DNS identifier. */}
      <Text style={[styles.ticketTerms, emphasised ? styles.onInkMuted : styles.onPaperMuted]}>
        One payment · works offline · no account needed
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PaperTheme.colors.paper,
  },
  content: {
    paddingTop: TOP_INSET + 24,
    paddingBottom: BOTTOM_INSET + 56,
    paddingHorizontal: PaperTheme.margin,
  },
  headRule: {
    height: PaperTheme.rules.head,
    backgroundColor: PaperTheme.colors.ink,
    marginBottom: 24,
  },
  keys: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  key: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    opacity: 0.55,
  },
  keyStub: {
    width: 12,
    height: 26,
    backgroundColor: PaperTheme.colors.ink,
  },
  keyBody: {
    width: 34,
    height: 26,
    marginLeft: 3,
    borderWidth: 2,
    borderColor: PaperTheme.colors.ink,
    justifyContent: 'center',
  },
  keyStripe: {
    height: 5,
    backgroundColor: PaperTheme.colors.ink,
    opacity: 0.5,
  },
  keyStrike: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: PaperTheme.colors.ink,
    transform: [{ rotate: '-24deg' }],
  },
  keysLabel: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.inkMuted,
    marginLeft: 8,
  },
  headline: {
    ...PaperTheme.type.headline,
    fontSize: 38,
    lineHeight: 42,
    color: PaperTheme.colors.ink,
  },
  subline: {
    ...PaperTheme.type.body,
    color: PaperTheme.colors.inkMuted,
    marginTop: 12,
  },
  serverMessage: {
    ...PaperTheme.type.aside,
    color: PaperTheme.colors.inkMuted,
    marginTop: 14,
  },
  skus: {
    marginTop: 28,
  },
  ticket: {
    minHeight: SubwayTheme.minTouchTarget + 24,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
  },
  ticketEmphasised: {
    backgroundColor: PaperTheme.colors.ink,
  },
  ticketPlain: {
    backgroundColor: PaperTheme.colors.paperShade,
    borderWidth: 2,
    borderColor: PaperTheme.colors.rule,
  },
  ticketPressed: {
    opacity: 0.8,
  },
  ticketHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ticketTitle: {
    flex: 1,
    paddingRight: 16,
  },
  ticketName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  ticketDetail: {
    ...PaperTheme.type.aside,
    marginTop: 5,
  },
  price: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  perforation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  perfDot: {
    width: 6,
    height: 2,
  },
  perfOnInk: {
    backgroundColor: PaperTheme.colors.paper,
    opacity: 0.4,
  },
  perfOnPaper: {
    backgroundColor: PaperTheme.colors.ink,
    opacity: 0.3,
  },
  ticketTerms: {
    ...PaperTheme.type.micro,
  },
  onInk: {
    color: PaperTheme.colors.paper,
  },
  onInkMuted: {
    color: PaperTheme.colors.paper,
    opacity: 0.75,
  },
  onPaper: {
    color: PaperTheme.colors.ink,
  },
  onPaperMuted: {
    color: PaperTheme.colors.inkMuted,
  },
  noSkus: {
    ...PaperTheme.type.body,
    color: PaperTheme.colors.inkMuted,
    marginTop: 20,
  },
  linkError: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.danger,
    marginTop: 18,
  },
  keepBox: {
    marginTop: 18,
  },
  dismiss: {
    marginTop: 34,
  },
});
