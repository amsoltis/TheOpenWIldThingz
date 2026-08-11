import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { TransitPacket, UserBillingProfile } from '@streetlevel/shared';
import {
  ON_DEVICE_SCHEMA_SQL,
  PINNED_PACKETS_SQL,
  validateTransitPacket,
} from '@streetlevel/shared';

import { PacketValidationError } from '../api/errors';

export const DATABASE_NAME = 'streetlevel.db';

/**
 * The offline survey layer plus the traveller's own downloaded trips.
 *
 * Everything here is written on the assumption that the phone has no signal.
 * That is not a degraded mode — it is the *expected* mode, because the moment
 * this app matters most is 60 feet underground with no bars. Any code path that
 * requires the network to render a route the user already downloaded is a bug.
 *
 * The infrastructure tables come from `@streetlevel/shared`: the same string
 * the seed generator emits its INSERTs against. Redefining them here would let
 * the two drift, and a seed that fails to load is discovered underground with
 * no signal and no way to fix it.
 *
 * `app_settings` is client-only. It backs the persisted device-id fallback,
 * which needs real durability rather than a session-scoped random, and the
 * last-known credit count shown on the planner before any network call.
 */
const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
${ON_DEVICE_SCHEMA_SQL}
${PINNED_PACKETS_SQL}

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   TEXT PRIMARY KEY NOT NULL,
  setting_value TEXT NOT NULL
);
`;

export interface PinnedPacketSummary {
  packetId: string;
  compiledAt: string;
  expiresAt: string | null;
  originAddress: string;
  destinationAddress: string;
  pinnedAt: string;
}

interface PinnedPacketRow {
  packet_id: string;
  compiled_at: string;
  expires_at: string | null;
  origin_address: string;
  destination_address: string;
  packet_json: string;
  pinned_at: string;
}

type PinnedPacketSummaryRow = Omit<PinnedPacketRow, 'packet_json'>;

let databasePromise: Promise<SQLiteDatabase> | null = null;

export async function openDb(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(SCHEMA_SQL);
      return db;
    })();
  }
  return databasePromise;
}

/** Test/reset hook: forgets the memoised handle so the next open re-runs the DDL. */
export function resetDbHandle(): void {
  databasePromise = null;
}

function toSummary(row: PinnedPacketSummaryRow): PinnedPacketSummary {
  return {
    packetId: row.packet_id,
    compiledAt: row.compiled_at,
    expiresAt: row.expires_at,
    originAddress: row.origin_address,
    destinationAddress: row.destination_address,
    pinnedAt: row.pinned_at,
  };
}

/**
 * Packets are validated on the way *in*, never on the way out. Once a trip is
 * on the phone it is the traveller's property and must render even if a later
 * build tightens the validator — refusing to open a downloaded walkthrough
 * because of a schema quibble would strand someone underground.
 */
export async function savePacket(packet: TransitPacket): Promise<void> {
  const result = validateTransitPacket(packet);
  if (!result.ok || !result.value) {
    throw new PacketValidationError(result.errors);
  }

  const db = await openDb();
  await db.runAsync(
    `INSERT INTO pinned_packets
       (packet_id, compiled_at, expires_at, origin_address, destination_address, packet_json, pinned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(packet_id) DO UPDATE SET
       compiled_at = excluded.compiled_at,
       expires_at = excluded.expires_at,
       origin_address = excluded.origin_address,
       destination_address = excluded.destination_address,
       packet_json = excluded.packet_json,
       pinned_at = excluded.pinned_at`,
    [
      packet.packetId,
      packet.compiledAt,
      packet.expiresAt ?? null,
      packet.outboundJourney.originAddress,
      packet.outboundJourney.destinationAddress,
      JSON.stringify(packet),
      new Date().toISOString(),
    ],
  );
}

export async function loadPacket(packetId: string): Promise<TransitPacket | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<Pick<PinnedPacketRow, 'packet_json'>>(
    'SELECT packet_json FROM pinned_packets WHERE packet_id = ?',
    [packetId],
  );
  if (!row) return null;
  return JSON.parse(row.packet_json) as TransitPacket;
}

export async function listPackets(): Promise<PinnedPacketSummary[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<PinnedPacketSummaryRow>(
    `SELECT packet_id, compiled_at, expires_at, origin_address, destination_address, pinned_at
       FROM pinned_packets
      ORDER BY pinned_at DESC`,
  );
  return rows.map(toSummary);
}

/** The most recently pinned trip, used to restore the deck on a cold start. */
export async function loadMostRecentPacket(): Promise<TransitPacket | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<Pick<PinnedPacketRow, 'packet_json'>>(
    'SELECT packet_json FROM pinned_packets ORDER BY pinned_at DESC LIMIT 1',
  );
  if (!row) return null;
  return JSON.parse(row.packet_json) as TransitPacket;
}

export async function deletePacket(packetId: string): Promise<void> {
  const db = await openDb();
  await db.runAsync('DELETE FROM pinned_packets WHERE packet_id = ?', [packetId]);
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export async function readSetting(key: string): Promise<string | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<{ setting_value: string }>(
    'SELECT setting_value FROM app_settings WHERE setting_key = ?',
    [key],
  );
  return row?.setting_value ?? null;
}

export async function writeSetting(key: string, value: string): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
    [key, value],
  );
}

const BILLING_SETTING_KEY = 'billing.profile';

/**
 * The credit count is shown on the planner before any network call happens, so
 * the last known figure is kept locally. It is advisory only — the server is
 * the meter of record and will answer 402 regardless of what this says.
 */
export async function saveBillingSnapshot(profile: UserBillingProfile): Promise<void> {
  await writeSetting(BILLING_SETTING_KEY, JSON.stringify(profile));
}

export async function loadBillingSnapshot(): Promise<UserBillingProfile | null> {
  const raw = await readSetting(BILLING_SETTING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserBillingProfile;
  } catch {
    return null;
  }
}
