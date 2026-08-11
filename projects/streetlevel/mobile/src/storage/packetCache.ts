import type { JourneyLeg, TransitPacket } from '@streetlevel/shared';

import type { LegKey } from '../state/appMachine';
import { deletePacket, listPackets, loadMostRecentPacket, loadPacket, savePacket } from './db';
import type { PinnedPacketSummary } from './db';

/**
 * A write-through cache in front of the SQLite store.
 *
 * The spec is explicit that switching between "My Outbound Trip" and "My Return
 * Home" must be instantaneous with no spinner. Both legs live inside a single
 * TransitPacket, so once the packet is resident in memory the toggle is a
 * synchronous property read — a promise there would show a flash of loading
 * state on a phone that may well have no signal to justify it.
 */
const resident = new Map<string, TransitPacket>();

export function getCachedPacket(packetId: string): TransitPacket | null {
  return resident.get(packetId) ?? null;
}

/** Synchronous by design: this is what makes the leg toggle instant. */
export function getCachedLeg(packetId: string, leg: LegKey): JourneyLeg | null {
  const packet = resident.get(packetId);
  if (!packet) return null;
  return leg === 'outbound' ? packet.outboundJourney : packet.returnJourney;
}

/**
 * Resident immediately, durable shortly after. The traveller can start swiping
 * the deck while the write lands; if the write fails they still have the trip
 * for this session and the error is surfaced rather than swallowed.
 */
export async function putPacket(packet: TransitPacket): Promise<void> {
  resident.set(packet.packetId, packet);
  await savePacket(packet);
}

export async function getPacket(packetId: string): Promise<TransitPacket | null> {
  const cached = resident.get(packetId);
  if (cached) return cached;
  const stored = await loadPacket(packetId);
  if (stored) resident.set(stored.packetId, stored);
  return stored;
}

/** Cold-start restore: puts the last trip back in the hand without a network call. */
export async function primeMostRecent(): Promise<TransitPacket | null> {
  const stored = await loadMostRecentPacket();
  if (stored) resident.set(stored.packetId, stored);
  return stored;
}

export async function listPacketSummaries(): Promise<PinnedPacketSummary[]> {
  return listPackets();
}

export async function forgetPacket(packetId: string): Promise<void> {
  resident.delete(packetId);
  await deletePacket(packetId);
}

/** Drops in-memory copies only. Disk is untouched — downloaded trips are permanent. */
export function clearResident(): void {
  resident.clear();
}
