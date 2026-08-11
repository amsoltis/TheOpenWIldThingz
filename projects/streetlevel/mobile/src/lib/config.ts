import Constants from 'expo-constants';

const DEFAULT_BASE_URL = 'https://api.streetlevel.app';
const DEFAULT_FREE_ALLOWANCE = 3;

function extraValue(key: string): unknown {
  const extra = Constants.expoConfig?.extra;
  return extra ? extra[key] : undefined;
}

export function resolveBaseUrl(): string {
  const configured = extraValue('apiBaseUrl');
  const base = typeof configured === 'string' && configured.length > 0 ? configured : DEFAULT_BASE_URL;
  return base.replace(/\/+$/, '');
}

/**
 * How many trips the meter gives away. Read from config rather than hard-coded
 * so the paywall copy ("your 3 free navigation keys") can never drift out of
 * step with what the server actually grants.
 */
export function resolveFreeAllowance(): number {
  const configured = extraValue('freeCreditAllowance');
  return typeof configured === 'number' && Number.isFinite(configured) ? configured : DEFAULT_FREE_ALLOWANCE;
}
