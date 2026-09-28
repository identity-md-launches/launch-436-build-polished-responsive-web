// Assembles one AgentProfile from every public source, recording where each
// value came from so the UI can label it (live / onchain / snapshot /
// unavailable) instead of inventing anything.

import { loadArtwork, type Artwork } from './artwork';
import { cached } from './cache';
import { readToken, reverseEns, type OnchainToken } from './chain';
import { MAX_TOKEN_ID, MIN_TOKEN_ID } from './config';
import { isHttpError } from './http';
import {
  fetchEarnings,
  fetchExplorerAgent,
  fetchRecords,
  fetchSeat,
  fetchStanding,
  type Earnings,
  type ExplorerAgent,
  type Seat,
  type Standing,
} from './imdApi';
import { computeRank, type Rank } from './rank';
import { loadEarningsSnapshot, loadSeatsSnapshot, type SnapshotAllocation, type SnapshotSeat } from './snapshot';

export type Provenance = 'live' | 'onchain' | 'snapshot' | 'unavailable';

export interface Sourced<T> {
  value: T | null;
  source: Provenance;
  at: string | null; // when the value was produced (snapshot time or fetch time)
  note: string | null; // why it is unavailable, or a caveat
}

export type CardState = 'working' | 'ready' | 'online' | 'offline' | 'unknown';

export type ApiStatus = 'live' | 'blocked' | 'offline' | 'error';

export interface SeatSummary {
  agentId: string | null;
  status: string | null;
  attempts: number;
  accepted: number;
  rejected: number;
  failed: number;
  pending: number;
  devices: number | null;
  runtimes: { id: string; version: string | null; model: string | null }[];
  pairedAt: string | null;
  online: boolean | null;
  lastWorkedAt: string | null;
  work: Seat['work'];
  reviews: Seat['reviews'];
  collaborators: Seat['collaborators'];
  collaboratorJobs: number | null;
}

export interface EarningsSummary {
  count: number;
  byChain: Record<string, number>;
  byKind: Record<string, number>;
  byStatus: Record<string, number>;
  latest: SnapshotAllocation[];
  complete: boolean; // true when the full list is present (live)
}

export interface AgentProfile {
  tokenId: number;
  chainId: number;
  onchain: OnchainToken;
  artwork: Sourced<Artwork>;
  owner: { address: string | null; source: Provenance };
  ens: Sourced<{ name: string; verified: boolean }>;
  publicHandle: Sourced<string>; // explorer ownerName
  seat: Sourced<SeatSummary>;
  standing: Sourced<Standing>;
  explorer: Sourced<ExplorerAgent>;
  earnings: Sourced<EarningsSummary>;
  rank: Sourced<Rank>;
  cardState: CardState;
  apiStatus: ApiStatus;
  snapshotAt: string | null;
  fetchedAt: string;
}

export class ProfileError extends Error {
  code: 'invalid-token' | 'nft-missing' | 'chain-unreachable';
  constructor(code: ProfileError['code'], message: string) {
    super(message);
    this.name = 'ProfileError';
    this.code = code;
  }
}

export function parseTokenId(input: string): number | null {
  const trimmed = input.trim().replace(/^#/, '');
  if (!/^\d{1,6}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (n < MIN_TOKEN_ID || n > MAX_TOKEN_ID) return null;
  return n;
}

const unavailable = <T>(note: string): Sourced<T> => ({ value: null, source: 'unavailable', at: null, note });

async function attempt<T>(loader: () => Promise<T>): Promise<{ value: T | null; error: unknown }> {
  try {
    return { value: await loader(), error: null };
  } catch (error) {
    return { value: null, error };
  }
}

function classifyApi(errors: unknown[]): ApiStatus {
  if (errors.length === 0) return 'live';
  if (errors.some((e) => isHttpError(e, 'unreachable') || isHttpError(e, 'timeout'))) {
    return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'blocked';
  }
  return 'error';
}

function summarizeSeat(seat: Seat): SeatSummary {
  const work = seat.work ?? [];
  const last = work
    .map((w) => w.submittedAt ?? null)
    .filter((x): x is string => !!x)
    .sort()
    .at(-1);
  return {
    agentId: seat.agentId ?? null,
    status: seat.status ?? null,
    attempts: seat.attempts ?? 0,
    accepted: seat.accepted ?? 0,
    rejected: seat.rejected ?? 0,
    failed: seat.failed ?? 0,
    pending: seat.pending ?? 0,
    devices: seat.devices ?? null,
    runtimes: (seat.runtimes ?? []).map((r) => ({
      id: r.id,
      version: r.version ?? null,
      model: r.premiumModel?.model ?? null,
    })),
    pairedAt: seat.pairedAt ?? null,
    online: typeof seat.online === 'boolean' ? seat.online : null,
    lastWorkedAt: last ?? null,
    work,
    reviews: seat.reviews ?? [],
    collaborators: seat.collaborators ?? [],
    collaboratorJobs: seat.collaboratorJobs ?? null,
  };
}

function seatFromSnapshot(s: SnapshotSeat): SeatSummary {
  return {
    agentId: s.agentId,
    status: null,
    attempts: s.attempts,
    accepted: s.accepted,
    rejected: s.rejected,
    failed: s.failed,
    pending: s.pending,
    devices: null,
    runtimes: [],
    pairedAt: null,
    online: s.online,
    lastWorkedAt: s.lastWorkedAt,
    work: [],
    reviews: [],
    collaborators: [],
    collaboratorJobs: null,
  };
}

function summarizeEarnings(e: Earnings): EarningsSummary {
  const byChain: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const x of e.earnings) {
    byChain[String(x.chainId)] = (byChain[String(x.chainId)] ?? 0) + 1;
    byKind[x.kind ?? 'unknown'] = (byKind[x.kind ?? 'unknown'] ?? 0) + 1;
    byStatus[x.status ?? 'unknown'] = (byStatus[x.status ?? 'unknown'] ?? 0) + 1;
  }
  const latest = [...e.earnings]
    .sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))
    .map((x) => ({
      launchId: x.launchId,
      launchNumber: x.launchNumber ?? null,
      status: x.status ?? null,
      chainId: x.chainId,
      kind: x.kind ?? null,
      symbol: x.token?.symbol ?? null,
      name: x.token?.name ?? null,
      address: x.token?.address ?? null,
      decimals: x.token?.decimals ?? 18,
      amount: String(x.amount),
      at: x.at ?? null,
    }));
  return { count: e.count ?? e.earnings.length, byChain, byKind, byStatus, latest, complete: !e.next };
}

export function deriveCardState(standing: Standing | null, seat: SeatSummary | null, seatSource: Provenance): CardState {
  if (standing?.presence) {
    const p = standing.presence;
    const working = (standing.standing?.working ?? 0) > 0 || (standing.standing?.running?.length ?? 0) > 0;
    if (!p.connected || p.stale) return 'offline';
    if (working) return 'working';
    return p.acceptingWork ? 'ready' : 'online';
  }
  if (seat && seatSource === 'live') return seat.online ? 'ready' : 'offline';
  return 'unknown';
}

export async function loadProfile(tokenId: number, { force = false } = {}): Promise<AgentProfile> {
  const fetchedAt = new Date().toISOString();
  const key = (name: string) => `${name}:${tokenId}`;

  // Onchain truth (artwork, ownership) and the official API in parallel.
  const [onchainRes, seatRes, standingRes, explorerRes, recordsRes] = await Promise.all([
    attempt(() => cached(key('onchain'), () => readToken(tokenId), { force })),
    attempt(() => cached(key('seat'), () => fetchSeat(tokenId), { force, persist: false })),
    attempt(() => cached(key('standing'), () => fetchStanding(tokenId), { force })),
    attempt(() => cached(key('explorer'), () => fetchExplorerAgent(tokenId), { force })),
    attempt(() => cached('records', () => fetchRecords(), { force, persist: false })),
  ]);

  if (!onchainRes.value) {
    throw new ProfileError('chain-unreachable', 'Unable to read the NFT from Ethereum. Check your connection and try again.');
  }
  const onchain = onchainRes.value;
  if (!onchain.owner) {
    throw new ProfileError('nft-missing', `identity.md #${tokenId} has not been minted or does not exist onchain.`);
  }

  const apiErrors = [seatRes.error, standingRes.error, explorerRes.error, recordsRes.error].filter(
    (e) => e && !isHttpError(e, 'not-found'),
  );
  const apiStatus = classifyApi(apiErrors);
  const apiUsable = apiStatus === 'live' || apiStatus === 'error';

  // Snapshot fallback only when the API could not be used.
  let seatsSnapshot = null;
  let earningsSnapshot = null;
  if (!apiUsable) {
    seatsSnapshot = (await attempt(loadSeatsSnapshot)).value;
    earningsSnapshot = (await attempt(loadEarningsSnapshot)).value;
  }
  const snapshotAt = seatsSnapshot?.generatedAt ?? null;
  const snapSeat = seatsSnapshot?.seats[String(tokenId)] ?? null;

  // Seat -----------------------------------------------------------------
  let seat: Sourced<SeatSummary>;
  if (seatRes.value) {
    seat = { value: summarizeSeat(seatRes.value), source: 'live', at: fetchedAt, note: null };
  } else if (isHttpError(seatRes.error, 'not-found')) {
    seat = unavailable('No agent device has paired with this NFT yet.');
  } else if (snapSeat) {
    seat = { value: seatFromSnapshot(snapSeat), source: 'snapshot', at: snapshotAt, note: 'From the last API snapshot.' };
  } else if (!apiUsable && seatsSnapshot) {
    seat = unavailable('Not in the API snapshot: this seat had no work records when the snapshot was taken.');
  } else {
    seat = unavailable('The IdentityMD API could not be reached.');
  }

  // Standing --------------------------------------------------------------
  let standing: Sourced<Standing>;
  if (standingRes.value) standing = { value: standingRes.value, source: 'live', at: fetchedAt, note: null };
  else if (isHttpError(standingRes.error, 'not-found')) standing = unavailable('No standing record: the NFT is not paired.');
  else standing = unavailable('Live presence needs the IdentityMD API, which this browser cannot reach.');

  // Explorer --------------------------------------------------------------
  let explorer: Sourced<ExplorerAgent>;
  if (explorerRes.value) explorer = { value: explorerRes.value, source: 'live', at: fetchedAt, note: null };
  else if (isHttpError(explorerRes.error, 'not-found')) explorer = unavailable('Not listed on the Explorer.');
  else if (snapSeat)
    explorer = {
      value: {
        tokenId: String(tokenId),
        online: snapSeat.online ?? undefined,
        owner: snapSeat.owner ?? undefined,
        ownerName: snapSeat.ownerName,
        held: snapSeat.held ?? undefined,
        attempts: snapSeat.attempts,
        accepted: snapSeat.accepted,
      },
      source: 'snapshot',
      at: snapshotAt,
      note: 'From the last API snapshot.',
    };
  else explorer = unavailable('The Explorer API could not be reached.');

  // Owner and names --------------------------------------------------------
  const owner = { address: onchain.owner, source: 'onchain' as Provenance };
  const ensRes = await attempt(() => cached(`ens:${onchain.owner}`, () => reverseEns(onchain.owner as string), { force }));
  const ens: Sourced<{ name: string; verified: boolean }> = ensRes.value?.name
    ? { value: { name: ensRes.value.name, verified: ensRes.value.verified }, source: 'onchain', at: fetchedAt, note: null }
    : unavailable(ensRes.error ? 'ENS lookup failed.' : 'No ENS reverse record for this owner.');
  const publicHandle: Sourced<string> = explorer.value?.ownerName
    ? { value: explorer.value.ownerName, source: explorer.source, at: explorer.at, note: null }
    : unavailable('No public handle on the Explorer.');

  // Artwork ---------------------------------------------------------------
  let artwork: Sourced<Artwork>;
  if (onchain.tokenURI) {
    const art = await attempt(() => loadArtwork(onchain.tokenURI as string));
    artwork = art.value
      ? { value: art.value, source: 'onchain', at: fetchedAt, note: null }
      : unavailable('The token metadata could not be decoded.');
  } else {
    artwork = unavailable('tokenURI returned nothing for this token.');
  }

  // Earnings --------------------------------------------------------------
  let earnings: Sourced<EarningsSummary>;
  if (apiUsable) {
    const e = await attempt(() => cached(`earnings:${onchain.owner}`, () => fetchEarnings(onchain.owner as string), { force, persist: false }));
    earnings = e.value
      ? { value: summarizeEarnings(e.value), source: 'live', at: fetchedAt, note: null }
      : unavailable('Earnings could not be loaded from the API.');
  } else {
    const w = earningsSnapshot?.wallets[onchain.owner.toLowerCase()] ?? null;
    earnings = w
      ? {
          value: { ...w, complete: false },
          source: 'snapshot',
          at: earningsSnapshot?.generatedAt ?? null,
          note: `Newest ${earningsSnapshot?.latestPerWallet ?? 6} allocations from the last API snapshot.`,
        }
      : unavailable(earningsSnapshot ? 'This wallet had no allocations in the last API snapshot.' : 'The IdentityMD API could not be reached.');
  }

  // Rank ------------------------------------------------------------------
  let rank: Sourced<Rank>;
  const rankInputs = recordsRes.value
    ? recordsRes.value.seats.map((s) => ({ tokenId: s.tokenId, attempts: s.attempts ?? 0, accepted: s.accepted ?? 0 }))
    : seatsSnapshot
      ? Object.entries(seatsSnapshot.seats).map(([id, s]) => ({ tokenId: id, attempts: s.attempts, accepted: s.accepted }))
      : null;
  if (rankInputs) {
    const r = computeRank(rankInputs, String(tokenId));
    rank = r
      ? { value: r, source: recordsRes.value ? 'live' : 'snapshot', at: recordsRes.value ? fetchedAt : snapshotAt, note: null }
      : unavailable('No work records yet, so no rank.');
  } else {
    rank = unavailable('Rankings need /seats/records, which this browser could not reach.');
  }

  const cardState = deriveCardState(standing.value, seat.value, seat.source);

  return {
    tokenId,
    chainId: 1,
    onchain,
    artwork,
    owner,
    ens,
    publicHandle,
    seat,
    standing,
    explorer,
    earnings,
    rank,
    cardState,
    apiStatus,
    snapshotAt,
    fetchedAt,
  };
}
