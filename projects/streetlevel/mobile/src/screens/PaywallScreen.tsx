import { useState } from 'react';
import type { ReactElement } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Application from 'expo-application';
import type { PaywallExceptionResponse, PaywallSku } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { PrimaryButton } from '../components/PrimaryButton';
import { TOP_INSET, BOTTOM_INSET } from '../lib/insets';
import { downloadedTripsReassurance, paywallHeadline, paywallSubline } from '../lib/paywallCopy';
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
 */
export function PaywallScreen({
  response,
  intendedDestination,
  freeAllowance,
  downloadedTripCount,
  onDismiss,
}: PaywallScreenProps): ReactElement {
  const [linkError, setLinkError] = useState<string | null>(null);

  const openSku = (sku: PaywallSku): void => {
    const url = storeProductUrl(sku.platformSkuString, Application.applicationId, Platform.OS);
    Linking.openURL(url).catch(() => {
      setLinkError(`We could not open ${storeName(Platform.OS)}. Your downloaded trips still work.`);
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>{paywallHeadline(freeAllowance)}</Text>
        <Text style={styles.subline}>{paywallSubline(intendedDestination)}</Text>

        {response.message.trim().length > 0 ? (
          <Text style={styles.serverMessage}>{response.message}</Text>
        ) : null}

        <View style={styles.benefits}>
          <Benefit text="Every trip compiled for both directions, before you go underground." />
          <Benefit text="Street-corner entrance checks so you take the right staircase the first time." />
          <Benefit text="The lost-and-found button, any time, anywhere on the system." />
        </View>

        {response.targetSkus.length > 0 ? (
          <View style={styles.skus}>
            {response.targetSkus.map((sku, index) => (
              <SkuRow
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
          <Text style={styles.keepCaption}>WHAT YOU ALREADY HAVE STAYS YOURS</Text>
          <Text style={styles.keepText}>{downloadedTripsReassurance(downloadedTripCount)}</Text>
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

function Benefit({ text }: { text: string }): ReactElement {
  return (
    <View style={styles.benefitRow}>
      <Text style={styles.benefitMark} accessibilityElementsHidden>
        ✓
      </Text>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

interface SkuRowProps {
  sku: PaywallSku;
  emphasised: boolean;
  onPress: () => void;
}

function SkuRow({ sku, emphasised, onPress }: SkuRowProps): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${sku.tierDescription || 'Unlock'} for ${sku.localizedPriceText}`}
      accessibilityHint={`Opens ${storeName(Platform.OS)} to complete the purchase.`}
      style={({ pressed }) => [
        styles.skuRow,
        emphasised ? styles.skuEmphasised : null,
        pressed ? styles.skuPressed : null,
      ]}
    >
      <View style={styles.skuText}>
        <Text style={[styles.skuTier, emphasised ? styles.onLight : styles.onDark]}>
          {sku.tierDescription || 'Lifetime access'}
        </Text>
        <Text style={[styles.skuId, emphasised ? styles.onLightMuted : styles.onDarkMuted]}>
          {sku.platformSkuString}
        </Text>
      </View>
      <Text style={[styles.skuPrice, emphasised ? styles.onLight : styles.onDark]}>
        {sku.localizedPriceText}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SubwayTheme.colors.backgroundDark,
  },
  content: {
    paddingTop: TOP_INSET + SubwayTheme.spacing.lg,
    paddingBottom: BOTTOM_INSET + SubwayTheme.spacing.xxl,
    paddingHorizontal: SubwayTheme.spacing.lg,
  },
  headline: {
    ...SubwayTheme.typography.macroActionTitle,
    color: SubwayTheme.colors.textPrimary,
  },
  subline: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
    color: SubwayTheme.colors.textPrimary,
    marginTop: SubwayTheme.spacing.md,
  },
  serverMessage: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
    marginTop: SubwayTheme.spacing.md,
  },
  benefits: {
    marginTop: SubwayTheme.spacing.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    marginBottom: SubwayTheme.spacing.md,
  },
  benefitMark: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.success,
    marginRight: SubwayTheme.spacing.sm,
  },
  benefitText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textPrimary,
    flexShrink: 1,
  },
  skus: {
    marginTop: SubwayTheme.spacing.md,
  },
  skuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: SubwayTheme.minTouchTarget + SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.button,
    paddingHorizontal: SubwayTheme.spacing.md,
    paddingVertical: SubwayTheme.spacing.md,
    marginBottom: SubwayTheme.spacing.sm,
    backgroundColor: SubwayTheme.colors.surfaceCard,
  },
  skuEmphasised: {
    backgroundColor: SubwayTheme.colors.success,
  },
  skuPressed: {
    opacity: 0.75,
  },
  skuText: {
    flexShrink: 1,
    paddingRight: SubwayTheme.spacing.md,
  },
  skuTier: {
    fontSize: 19,
    fontWeight: '800',
  },
  skuId: {
    ...SubwayTheme.typography.metaLabel,
    marginTop: SubwayTheme.spacing.xs,
  },
  skuPrice: {
    fontSize: 24,
    fontWeight: '900',
  },
  onLight: {
    color: SubwayTheme.colors.backgroundDark,
  },
  onLightMuted: {
    color: SubwayTheme.colors.backgroundDark,
    opacity: 0.7,
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
    marginTop: SubwayTheme.spacing.xl,
    padding: SubwayTheme.spacing.md,
    borderRadius: SubwayTheme.radii.button,
    borderWidth: 2,
    borderColor: SubwayTheme.colors.success,
  },
  keepCaption: {
    ...SubwayTheme.typography.metaLabel,
    color: SubwayTheme.colors.success,
    marginBottom: SubwayTheme.spacing.sm,
  },
  keepText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textPrimary,
  },
  dismiss: {
    marginTop: SubwayTheme.spacing.xl,
  },
});
