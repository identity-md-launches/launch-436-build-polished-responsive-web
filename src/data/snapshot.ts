// Build-time snapshot of the official API (see scripts/snapshot.mjs). Used
// only when the live API cannot be reached from the browser.

import { cached } from './cache';
import { getJson } from './http';

export interface SnapshotSeat {
  agentId: string | null;
  attempts: number;
  accepted: number;
  rejected: number;
  failed: number;
  pending: number;
  lastWorkedAt: string | null;
  owner: string | null;
  ownerName: string | null;
  held: number | null;
  online: boolean | null;
}

export interface SeatsSnapshot {
  generatedAt: string;
  sources: string[];
  count: number;
  seats: Record<string, SnapshotSeat>;
}

export interface SnapshotAllocation {
  launchId: string;
  launchNumber: number | null;
  status: string | null;
  chainId: number;
  kind: string | null;
  symbol: string | null;
  name: string | null;
  address: string | null;
  decimals: number;
  amount: string;
  at: string | null;
}

export interface SnapshotWallet {
  count: number;
  byChain: Record<string, number>;
  byKind: Record<string, number>;
  byStatus: Record<string, number>;
  latest: SnapshotAllocation[];
}

export interface EarningsSnapshot {
  generatedAt: string;
  sources: string[];
  latestPerWallet: number;
  wallets: Record<string, SnapshotWallet>;
}

function snapshotUrl(file: string): string {
  return new URL(`./snapshot/${file}`, document.baseURI).toString();
}

export const loadSeatsSnapshot = () =>
  cached('snapshot:seats', () => getJson<SeatsSnapshot>(snapshotUrl('seats.json')), { ttl: 10 * 60_000, persist: false });

export const loadEarningsSnapshot = () =>
  cached('snapshot:earnings', () => getJson<EarningsSnapshot>(snapshotUrl('earnings.json')), {
    ttl: 10 * 60_000,
    persist: false,
  });
