import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { readSetting, writeSetting } from '../storage/db';

/**
 * The freemium meter is bound to a device, not an account — there is no signup
 * in this product, because a tourist who has to make an account before they can
 * find the subway will simply not find the subway.
 *
 * That makes this identifier load-bearing for billing, so it has to be stable
 * across launches. The platform-provided vendor ids are stable for the life of
 * the install; when they are unavailable we fall back to a value persisted in
 * our own SQLite store, which is stable for exactly as long as the app's data
 * is. Both reset on uninstall, which is the honest limit of an anonymous meter.
 */
const FALLBACK_SETTING_KEY = 'device.fallbackId';

let cached: string | null = null;

function randomFallbackId(): string {
  const entropy = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  return `slfallback-${entropy}`;
}

async function platformDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      const androidId = Application.getAndroidId();
      return androidId.length > 0 ? androidId : null;
    }
    if (Platform.OS === 'ios') {
      return await Application.getIosIdForVendorAsync();
    }
  } catch {
    // Falls through to the persisted fallback below. A missing vendor id is a
    // metering inconvenience; it must never stop a trip from compiling.
  }
  return null;
}

async function persistedFallbackId(): Promise<string> {
  const existing = await readSetting(FALLBACK_SETTING_KEY);
  if (existing) return existing;
  const generated = randomFallbackId();
  await writeSetting(FALLBACK_SETTING_KEY, generated);
  return generated;
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const platformId = await platformDeviceId();
  if (platformId) {
    cached = platformId;
    return cached;
  }
  cached = await persistedFallbackId();
  return cached;
}

/** Test/reset hook. */
export function clearCachedDeviceId(): void {
  cached = null;
}
