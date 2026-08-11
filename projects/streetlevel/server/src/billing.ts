import type { UserBillingProfile } from '@streetlevel/shared';
import pg from 'pg';

export type DevicePlatform = 'IOS' | 'ANDROID';

export interface ConsumeResult {
  ok: boolean;
  profile: UserBillingProfile;
}

/**
 * The metering store.
 *
 * Balances live server-side and are keyed on the device's vendor identifier
 * because the alternative — a counter in local storage — resets with a
 * reinstall. That is the entire reason this is not a client-side concern.
 */
export interface AccountStore {
  ensure(deviceId: string, platform: DevicePlatform): Promise<UserBillingProfile>;
  get(deviceId: string): Promise<UserBillingProfile | null>;
  /** Atomically spends one credit. Premium accounts always succeed and never decrement. */
  consumeCredit(deviceId: string, platform: DevicePlatform): Promise<ConsumeResult>;
  /** Returns a credit spent on work that then failed. */
  refundCredit(deviceId: string): Promise<void>;
  grantPremium(deviceId: string): Promise<UserBillingProfile>;
  close(): Promise<void>;
}

export const USER_ACCOUNTS_DDL = `
CREATE TABLE IF NOT EXISTS user_accounts (
    device_id VARCHAR(255) PRIMARY KEY NOT NULL,
    device_platform VARCHAR(10) CHECK(device_platform IN ('IOS', 'ANDROID')) NOT NULL,
    credits_remaining INT DEFAULT 3 CHECK(credits_remaining >= 0),
    is_premium_unlocked INT CHECK(is_premium_unlocked IN (0, 1)) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_accounts_lookup ON user_accounts (device_id, is_premium_unlocked);
`;

interface AccountRow {
  device_id: string;
  credits_remaining: number;
  is_premium_unlocked: number;
  created_at: Date | string;
}

function toProfile(row: AccountRow): UserBillingProfile {
  return {
    deviceId: row.device_id,
    creditsRemaining: row.credits_remaining,
    isPremiumUnlocked: row.is_premium_unlocked === 1,
    registrationDate: new Date(row.created_at).toISOString(),
  };
}

export class PostgresAccountStore implements AccountStore {
  private readonly pool: pg.Pool;

  constructor(
    connectionString: string,
    private readonly freeCredits: number,
  ) {
    this.pool = new pg.Pool({ connectionString });
  }

  async migrate(): Promise<void> {
    await this.pool.query(USER_ACCOUNTS_DDL);
  }

  async ensure(deviceId: string, platform: DevicePlatform): Promise<UserBillingProfile> {
    const { rows } = await this.pool.query<AccountRow>(
      `INSERT INTO user_accounts (device_id, device_platform, credits_remaining)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING device_id, credits_remaining, is_premium_unlocked, created_at`,
      [deviceId, platform, this.freeCredits],
    );
    return toProfile(rows[0]!);
  }

  async get(deviceId: string): Promise<UserBillingProfile | null> {
    const { rows } = await this.pool.query<AccountRow>(
      'SELECT device_id, credits_remaining, is_premium_unlocked, created_at FROM user_accounts WHERE device_id = $1',
      [deviceId],
    );
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async consumeCredit(deviceId: string, platform: DevicePlatform): Promise<ConsumeResult> {
    await this.ensure(deviceId, platform);
    // A single conditional UPDATE, so two requests racing from the same device
    // cannot both spend the last credit.
    const { rows } = await this.pool.query<AccountRow>(
      `UPDATE user_accounts
          SET credits_remaining = CASE WHEN is_premium_unlocked = 1 THEN credits_remaining ELSE credits_remaining - 1 END,
              updated_at = CURRENT_TIMESTAMP
        WHERE device_id = $1 AND (is_premium_unlocked = 1 OR credits_remaining > 0)
        RETURNING device_id, credits_remaining, is_premium_unlocked, created_at`,
      [deviceId],
    );
    if (rows[0]) return { ok: true, profile: toProfile(rows[0]) };

    const profile = await this.get(deviceId);
    return {
      ok: false,
      profile: profile ?? {
        deviceId,
        creditsRemaining: 0,
        isPremiumUnlocked: false,
        registrationDate: new Date().toISOString(),
      },
    };
  }

  async refundCredit(deviceId: string): Promise<void> {
    await this.pool.query(
      `UPDATE user_accounts
          SET credits_remaining = credits_remaining + 1, updated_at = CURRENT_TIMESTAMP
        WHERE device_id = $1 AND is_premium_unlocked = 0`,
      [deviceId],
    );
  }

  async grantPremium(deviceId: string): Promise<UserBillingProfile> {
    const { rows } = await this.pool.query<AccountRow>(
      `UPDATE user_accounts SET is_premium_unlocked = 1, updated_at = CURRENT_TIMESTAMP
        WHERE device_id = $1
        RETURNING device_id, credits_remaining, is_premium_unlocked, created_at`,
      [deviceId],
    );
    if (!rows[0]) throw new Error(`Unknown device ${deviceId}`);
    return toProfile(rows[0]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Used for local development and tests. Balances vanish on restart, which is
 * fine for a dev loop and unacceptable in production — `loadConfig` picks the
 * Postgres store whenever DATABASE_URL is set.
 */
export class InMemoryAccountStore implements AccountStore {
  private readonly accounts = new Map<string, UserBillingProfile>();

  constructor(private readonly freeCredits: number) {}

  async ensure(deviceId: string, _platform: DevicePlatform = 'IOS'): Promise<UserBillingProfile> {
    const existing = this.accounts.get(deviceId);
    if (existing) return existing;
    const created: UserBillingProfile = {
      deviceId,
      creditsRemaining: this.freeCredits,
      isPremiumUnlocked: false,
      registrationDate: new Date().toISOString(),
    };
    this.accounts.set(deviceId, created);
    return created;
  }

  async get(deviceId: string): Promise<UserBillingProfile | null> {
    return this.accounts.get(deviceId) ?? null;
  }

  async consumeCredit(deviceId: string, platform: DevicePlatform): Promise<ConsumeResult> {
    const profile = await this.ensure(deviceId, platform);
    if (profile.isPremiumUnlocked) return { ok: true, profile };
    if (profile.creditsRemaining <= 0) return { ok: false, profile };
    const updated = { ...profile, creditsRemaining: profile.creditsRemaining - 1 };
    this.accounts.set(deviceId, updated);
    return { ok: true, profile: updated };
  }

  async refundCredit(deviceId: string): Promise<void> {
    const profile = this.accounts.get(deviceId);
    if (!profile || profile.isPremiumUnlocked) return;
    this.accounts.set(deviceId, { ...profile, creditsRemaining: profile.creditsRemaining + 1 });
  }

  async grantPremium(deviceId: string): Promise<UserBillingProfile> {
    const profile = await this.ensure(deviceId, 'IOS');
    const updated = { ...profile, isPremiumUnlocked: true };
    this.accounts.set(deviceId, updated);
    return updated;
  }

  async close(): Promise<void> {
    this.accounts.clear();
  }
}
