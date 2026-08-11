import { useState } from 'react';
import type { ReactElement } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Application from 'expo-application';
import type { PaywallExceptionResponse, PaywallSku } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { AlertNote } from '../components/AlertNote';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionCaption } from '../components/SectionCaption';
import { VerticalFade } from '../components/VerticalFade';
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
 * The pass itself is then drawn as a thing you get rather than as a row in a
 * settings list — same MTA plate vernacular as the signs the product has been
 * teaching them to trust for the whole journey.
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
      <VerticalFade
        color={SubwayTheme.colors.success}
        height={280}
        anchor="top"
        maxAlpha={0.14}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SpentKeys allowance={freeAllowance} />

        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subline}>{subline}</Text>

        {serverMessage ? <Text style={styles.serverMessage}>{serverMessage}</Text> : null}

        <View style={styles.benefits}>
          <SectionCaption label="WHAT LIFETIME ACCESS GIVES YOU" />
          <View style={styles.benefitWell}>
            <Benefit text="Every trip compiled for both directions, before you go underground." first />
            <Benefit text="Street-corner entrance checks so you take the right staircase the first time." />
            <Benefit text="The lost-and-found button, any time, anywhere on the system." />
          </View>
        </View>

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
          <AlertNote
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

function Benefit({ text, first = false }: { text: string; first?: boolean }): ReactElement {
  return (
    <View style={[styles.benefitRow, first ? null : styles.benefitDivided]}>
      <View style={styles.benefitMark} accessibilityElementsHidden>
        <Text style={styles.benefitTick} allowFontScaling={false}>
          ✓
        </Text>
      </View>
      <Text style={styles.benefitText}>{text}</Text>
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
          <Text style={[styles.ticketName, emphasised ? styles.onLight : styles.onDark]}>
            {name}
          </Text>
          {detail ? (
            <Text style={[styles.ticketDetail, emphasised ? styles.onLightMuted : styles.onDarkMuted]}>
              {detail}
            </Text>
          ) : null}
        </View>
        <View style={[styles.pricePill, emphasised ? styles.pricePillOnLight : styles.pricePillOnDark]}>
          <Text style={[styles.price, emphasised ? styles.onDark : styles.onLight]}>
            {sku.localizedPriceText}
          </Text>
        </View>
      </View>

      {/* The perforation. It is the difference between a row in a list and a
          ticket you are about to be handed. */}
      <View style={styles.perforation} accessibilityElementsHidden>
        {Array.from({ length: 22 }, (_, i) => (
          <View
            key={i}
            style={[styles.perfDot, emphasised ? styles.perfOnLight : styles.perfOnDark]}
          />
        ))}
      </View>

      {/* The store product id is plumbing. It was on screen; nobody buying a
          subway app needs to read a reverse-DNS identifier. */}
      <Text style={[styles.ticketTerms, emphasised ? styles.onLightMuted : styles.onDarkMuted]}>
        One payment · works offline · no account needed
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SubwayTheme.colors.backgroundDeep,
  },
  content: {
    paddingTop: TOP_INSET + SubwayTheme.spacing.lg,
    paddingBottom: BOTTOM_INSET + SubwayTheme.spacing.xxl,
    paddingHorizontal: SubwayTheme.spacing.lg,
  },
  keys: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SubwayTheme.spacing.lg,
  },
  key: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SubwayTheme.spacing.sm,
    opacity: 0.5,
  },
  keyStub: {
    width: 12,
    height: 26,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    backgroundColor: SubwayTheme.colors.textTertiary,
  },
  keyBody: {
    width: 34,
    height: 26,
    marginLeft: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: SubwayTheme.borders.emphasis,
    borderColor: SubwayTheme.colors.textTertiary,
    justifyContent: 'center',
  },
  keyStripe: {
    height: 5,
    backgroundColor: SubwayTheme.colors.textTertiary,
    opacity: 0.6,
  },
  keyStrike: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: SubwayTheme.colors.textSecondary,
    transform: [{ rotate: '-24deg' }],
  },
  keysLabel: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textTertiary,
    marginLeft: SubwayTheme.spacing.sm,
  },
  headline: {
    ...SubwayTheme.typography.macroActionTitle,
    color: SubwayTheme.colors.textPrimary,
  },
  subline: {
    ...SubwayTheme.typography.sectionTitle,
    fontSize: 19,
    lineHeight: 26,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.sm,
  },
  serverMessage: {
    ...SubwayTheme.typography.supportBody,
    color: SubwayTheme.colors.textTertiary,
    marginTop: SubwayTheme.spacing.md,
  },
  benefits: {
    marginTop: SubwayTheme.spacing.xl,
  },
  benefitWell: {
    marginTop: SubwayTheme.spacing.sm,
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderRadius: SubwayTheme.radii.chip,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
    paddingHorizontal: SubwayTheme.spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SubwayTheme.spacing.md,
  },
  benefitDivided: {
    borderTopWidth: SubwayTheme.borders.hairline,
    borderTopColor: SubwayTheme.colors.hairline,
  },
  benefitMark: {
    width: 22,
    height: 22,
    borderRadius: SubwayTheme.radii.bullet,
    backgroundColor: SubwayTheme.colors.successWash,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SubwayTheme.spacing.md,
  },
  benefitTick: {
    fontSize: 12,
    fontWeight: '900',
    color: SubwayTheme.colors.success,
    includeFontPadding: false,
  },
  benefitText: {
    ...SubwayTheme.typography.supportBody,
    fontSize: 16,
    lineHeight: 22,
    color: SubwayTheme.colors.textPrimary,
    flexShrink: 1,
  },
  skus: {
    marginTop: SubwayTheme.spacing.xl,
  },
  ticket: {
    minHeight: SubwayTheme.minTouchTarget + SubwayTheme.spacing.lg,
    borderRadius: SubwayTheme.radii.card,
    padding: SubwayTheme.spacing.md,
    marginBottom: SubwayTheme.spacing.md,
    overflow: 'hidden',
  },
  ticketEmphasised: {
    backgroundColor: SubwayTheme.colors.success,
    boxShadow: '0px 14px 30px rgba(48,209,88,0.25)',
  },
  ticketPlain: {
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
  },
  ticketPressed: {
    opacity: 0.8,
  },
  ticketHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketTitle: {
    flex: 1,
    paddingRight: SubwayTheme.spacing.md,
  },
  ticketName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  ticketDetail: {
    ...SubwayTheme.typography.supportBody,
    marginTop: SubwayTheme.spacing.xs,
  },
  pricePill: {
    borderRadius: SubwayTheme.radii.bullet,
    paddingHorizontal: SubwayTheme.spacing.md,
    paddingVertical: SubwayTheme.spacing.sm,
  },
  pricePillOnLight: {
    backgroundColor: SubwayTheme.colors.backgroundDeep,
  },
  pricePillOnDark: {
    backgroundColor: SubwayTheme.colors.textPrimary,
  },
  price: {
    fontSize: 22,
    fontWeight: '900',
  },
  perforation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: SubwayTheme.spacing.md,
  },
  perfDot: {
    width: 6,
    height: 2,
    borderRadius: 1,
  },
  perfOnLight: {
    backgroundColor: SubwayTheme.colors.backgroundDeep,
    opacity: 0.35,
  },
  perfOnDark: {
    backgroundColor: SubwayTheme.colors.textTertiary,
    opacity: 0.6,
  },
  ticketTerms: {
    ...SubwayTheme.typography.microLabel,
  },
  onLight: {
    color: SubwayTheme.colors.backgroundDeep,
  },
  onLightMuted: {
    color: SubwayTheme.colors.backgroundDeep,
    opacity: 0.72,
  },
  onDark: {
    color: SubwayTheme.colors.textPrimary,
  },
  onDarkMuted: {
    color: SubwayTheme.colors.textSecondary,
  },
  noSkus: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.md,
  },
  linkError: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.danger,
    marginTop: SubwayTheme.spacing.md,
  },
  keepBox: {
    marginTop: SubwayTheme.spacing.md,
  },
  dismiss: {
    marginTop: SubwayTheme.spacing.xl,
  },
});
