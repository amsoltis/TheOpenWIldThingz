/**
 * There is no in-app-purchase module in this build, so the paywall hands off to
 * the platform store listing for the SKU. That is a real, completable purchase
 * path rather than a dead button, and it keeps the client free of a billing SDK
 * whose consent prompts would fire while someone is standing on a street corner.
 */
export function storeProductUrl(sku: string, applicationId: string | null, os: string): string {
  const encodedSku = encodeURIComponent(sku);
  if (os === 'android') {
    const appId = applicationId ?? sku;
    return `market://details?id=${encodeURIComponent(appId)}&sku=${encodedSku}`;
  }
  return `itms-apps://apps.apple.com/account/subscriptions?product=${encodedSku}`;
}

export function storeName(os: string): string {
  return os === 'android' ? 'Google Play' : 'the App Store';
}
