// Public data is kept with its source and observation time. Missing values
// stay null; a failed endpoint does not discard successful sibling requests.
import { loadArtwork, type Artwork } from './artwork';
import { cached } from './cache';
import { readAcquisition, readToken, reverseEns, type Acquisition, type OnchainToken } from './chain';
import { MAX_TOKEN_ID, MIN_TOKEN_ID } from './config';
import { isHttpError } from './http';
import {
  fetchEarnings, fetchExplorerAgent, fetchExplorerPage, fetchRecords, fetchSeat, fetchStanding,
  type Earnings, type ExplorerAgent, type ExplorerPage, type RecordSeat, type Seat, type Standing,
} from './imdApi';
import { computeRank, type Rank } from './rank';
import { loadEarningsSnapshot, loadSeatsSnapshot, type SnapshotAllocation, type SnapshotSeat } from './snapshot';

export type Provenance = 'live' | 'onchain' | 'snapshot' | 'unavailable';
export interface Sourced<T> {
  value: T | null;
  source: Provenance;
  at: string | null;
  note: string | null;
}
export type CardState = 'working' | 'ready' | 'online' | 'offline' | 'unknown';
export type ApiStatus = 'live' | 'blocked' | 'offline' | 'error';
export interface SeatSummary {
  agentId: string | null;
  status: string | null;
  attempts: number | null;
  accepted: number | null;
  rejected: number | null;
  failed: number | null;
  pending: number | null;
  devices: number | null;
  runtimes: { id: string; version: string | null; model: string | null }[];
  pairedAt: string | null;
  online: boolean | null;
  lastWorkedAt: string | null;
  work: NonNullable<Seat['work']>;
  reviews: NonNullable<Seat['reviews']>;
  historyAvailable: boolean;
  reviewsAvailable: boolean;
  collaborators: NonNullable<Seat['collaborators']>;
  collaboratorJobs: number | null;
}
export interface EarningsSummary {
  count: number;
  byChain: Record<string, number>;
  byKind: Record<string, number>;
  byStatus: Record<string, number>;
  latest: SnapshotAllocation[];
  complete: boolean;
}
export interface AgentProfile {
  tokenId: number;
  chainId: number;
  onchain: OnchainToken;
  artwork: Sourced<Artwork>;
  owner: { address: string | null; source: Provenance };
  acquisition: Sourced<Acquisition>;
  ens: Sourced<{ name: string; verified: boolean }>;
  publicHandle: Sourced<string>;
  seat: Sourced<SeatSummary>;
  standing: Sourced<Standing>;
  runtime: Sourced<SeatSummary['runtimes']>;
  lastActivity: Sourced<string>;
  work: Sourced<NonNullable<Seat['work']>>;
  reviews: Sourced<NonNullable<Seat['reviews']>>;
  explorer: Sourced<ExplorerAgent>;
  explorerPage: Sourced<ExplorerPage>;
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
    super(message); this.name = 'ProfileError'; this.code = code;
  }
}
export function parseTokenId(input: string): number | null {
  const trimmed = input.trim().replace(/^#/, '');
  if (!/^\d{1,6}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n < MIN_TOKEN_ID || n > MAX_TOKEN_ID ? null : n;
}
const unavailable = <T>(note: string): Sourced<T> => ({ value: null, source: 'unavailable', at: null, note });
const sourced = <T>(value: T, source: Provenance, at: string | null, note: string | null = null): Sourced<T> => ({ value, source, at, note });
const count = (n: unknown): number | null => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
function validDate(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}
function newest(values: unknown[]): string | null {
  return values.map(validDate).filter((x): x is string => x !== null).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}
async function attempt<T>(loader: () => Promise<T>): Promise<{ value: T | null; error: unknown; at: string }> {
  try { return { value: await loader(), error: null, at: new Date().toISOString() }; }
  catch (error) { return { value: null, error, at: new Date().toISOString() }; }
}
function classifyApi(errors: unknown[]): ApiStatus {
  if (!errors.length) return 'live';
  if (errors.some((e) => isHttpError(e, 'unreachable') || isHttpError(e, 'timeout'))) {
    return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'blocked';
  }
  return 'error';
}
function summarizeRuntimes(runtimes: Seat['runtimes']): SeatSummary['runtimes'] {
  return Array.isArray(runtimes) ? runtimes.filter((r) => r && typeof r.id === 'string').map((r) => ({
    id: r.id, version: r.version ?? null, model: r.premiumModel?.model ?? null,
  })) : [];
}
export function summarizeSeat(seat: Seat, record?: RecordSeat): SeatSummary {
  const work = Array.isArray(seat.work) ? seat.work : [];
  return {
    agentId: seat.agentId ?? record?.agentId ?? null,
    status: seat.status ?? null,
    attempts: count(seat.attempts) ?? count(record?.attempts),
    accepted: count(seat.accepted) ?? count(record?.accepted),
    rejected: count(seat.rejected) ?? count(record?.rejected),
    failed: count(seat.failed) ?? count(record?.failed),
    pending: count(seat.pending) ?? count(record?.pending),
    devices: count(seat.devices), runtimes: summarizeRuntimes(seat.runtimes),
    pairedAt: validDate(seat.pairedAt), online: typeof seat.online === 'boolean' ? seat.online : null,
    lastWorkedAt: newest([record?.lastWorkedAt, ...work.flatMap((w) => [w.submittedAt, w.acceptedAt])]),
    work, reviews: Array.isArray(seat.reviews) ? seat.reviews : [],
    historyAvailable: Array.isArray(seat.work), reviewsAvailable: Array.isArray(seat.reviews),
    collaborators: Array.isArray(seat.collaborators) ? seat.collaborators : [],
    collaboratorJobs: count(seat.collaboratorJobs),
  };
}
function seatFromSnapshot(s: SnapshotSeat, tokenId: number): SeatSummary {
  return summarizeSeat({ tokenId: String(tokenId), agentId: s.agentId ?? undefined,
    online: s.online ?? undefined, runtimes: s.runtimes, work: s.work, reviews: s.reviews,
  }, { tokenId: String(tokenId), agentId: s.agentId ?? undefined,
    attempts: s.attempts ?? undefined, accepted: s.accepted ?? undefined, rejected: s.rejected ?? undefined,
    failed: s.failed ?? undefined, pending: s.pending ?? undefined, lastWorkedAt: s.lastWorkedAt,
  });
}
export function summarizeEarnings(e: Earnings): EarningsSummary {
  const byChain: Record<string, number> = {}, byKind: Record<string, number> = {}, byStatus: Record<string, number> = {};
  for (const x of e.earnings) {
    byChain[String(x.chainId)] = (byChain[String(x.chainId)] ?? 0) + 1;
    byKind[x.kind ?? 'unknown'] = (byKind[x.kind ?? 'unknown'] ?? 0) + 1;
    byStatus[x.status ?? 'unknown'] = (byStatus[x.status ?? 'unknown'] ?? 0) + 1;
  }
  const latest = [...e.earnings].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? ''))).map((x) => ({
    launchId: x.launchId, launchNumber: x.launchNumber ?? null, status: x.status ?? null,
    chainId: x.chainId, kind: x.kind ?? null, symbol: x.token?.symbol ?? null, name: x.token?.name ?? null,
    address: x.token?.address ?? null, decimals: x.token?.decimals ?? 18, amount: String(x.amount), at: x.at ?? null,
  }));
  // count is the number of records on this API page, not a lifetime payout total.
  return { count: e.earnings.length, byChain, byKind, byStatus, latest, complete: e.next == null };
}
export function deriveCardState(standing: Standing | null, seat: SeatSummary | null, seatSource: Provenance): CardState {
  if (standing?.presence) {
    const p = standing.presence;
    if (p.connected === false || p.stale === true) return 'offline';
    if (p.connected !== true || p.stale !== false) return 'unknown';
    if ((standing.standing?.working ?? 0) > 0 || (standing.standing?.running?.length ?? 0) > 0) return 'working';
    return p.acceptingWork === true ? 'ready' : 'online';
  }
  if (seatSource === 'live' && typeof seat?.online === 'boolean') return seat.online ? 'online' : 'offline';
  return 'unknown';
}

export async function loadProfile(tokenId: number, { force = false } = {}): Promise<AgentProfile> {
  if (parseTokenId(String(tokenId)) === null) throw new ProfileError('invalid-token', 'Enter a valid IdentityMD token ID.');
  // API responses are requested on each load/Refresh, so a cache cannot be
  // relabelled as newly fetched. Bundled files have their own immutable times.
  const [onchainRes, seatRes, standingRes, explorerRes, pageRes, recordsRes, snapshotsRes, earningsSnapshotRes] = await Promise.all([
    attempt(() => cached(`onchain:${tokenId}`, () => readToken(tokenId), { force })),
    attempt(() => fetchSeat(tokenId)), attempt(() => fetchStanding(tokenId)),
    attempt(() => fetchExplorerAgent(tokenId)), attempt(() => fetchExplorerPage(tokenId)), attempt(fetchRecords),
    attempt(loadSeatsSnapshot), attempt(loadEarningsSnapshot),
  ]);
  if (!onchainRes.value) throw new ProfileError('chain-unreachable', 'Unable to read the NFT from Ethereum. Check your connection and try again.');
  const onchain = onchainRes.value;
  if (!onchain.owner) throw new ProfileError('nft-missing', `identity.md #${tokenId} has not been minted or does not exist onchain.`);
  const address = onchain.owner;
  const [ensRes, artRes, earningRes, acquisitionRes] = await Promise.all([
    attempt(() => cached(`ens:${address}`, () => reverseEns(address), { force })),
    attempt(() => onchain.tokenURI ? loadArtwork(onchain.tokenURI) : Promise.resolve(null)),
    attempt(() => fetchEarnings(address)), attempt(() => readAcquisition(tokenId, address)),
  ]);
  const apiStatus = classifyApi([seatRes.error, standingRes.error, explorerRes.error, pageRes.error, recordsRes.error, earningRes.error]
    .filter((e) => e && !isHttpError(e, 'not-found')));
  const seatsSnapshot = snapshotsRes.value, earningsSnapshot = earningsSnapshotRes.value;
  const snapshotAt = seatsSnapshot?.generatedAt ?? null;
  const snapSeat = seatsSnapshot?.seats[String(tokenId)] ?? null;
  const liveRecord = recordsRes.value?.seats.find((s) => String(s.tokenId) === String(tokenId));
  let seat: Sourced<SeatSummary>;
  if (seatRes.value) seat = sourced(summarizeSeat(seatRes.value, liveRecord), 'live', seatRes.at);
  else if (liveRecord) seat = sourced(summarizeSeat({ tokenId: String(tokenId) }, liveRecord), 'live', recordsRes.at, 'From public work records.');
  else if (snapSeat && !isHttpError(seatRes.error, 'not-found')) seat = sourced(seatFromSnapshot(snapSeat, tokenId), 'snapshot', snapshotAt, 'Bundled work records.');
  else seat = unavailable(isHttpError(seatRes.error, 'not-found') ? 'No public seat record for this NFT.' : 'No public work record could be loaded.');
  const standing = standingRes.value ? sourced(standingRes.value, 'live', validDate(standingRes.value.at) ?? standingRes.at)
    : unavailable<Standing>('Live presence could not be reached.');
  const explorer = explorerRes.value ? sourced(explorerRes.value, 'live', explorerRes.at)
    : snapSeat ? sourced<ExplorerAgent>({ tokenId: String(tokenId), owner: snapSeat.owner ?? undefined,
      ownerName: snapSeat.ownerName, online: snapSeat.online ?? undefined,
      attempts: snapSeat.attempts ?? undefined, accepted: snapSeat.accepted ?? undefined,
    }, 'snapshot', snapshotAt, 'Bundled Explorer record.') : unavailable<ExplorerAgent>('Explorer record unavailable.');
  const explorerPage = pageRes.value ? sourced(pageRes.value, 'live', pageRes.at)
    : unavailable<ExplorerPage>('The public Explorer page could not be read.');
  const ens = ensRes.value?.name ? sourced({ name: ensRes.value.name, verified: ensRes.value.verified }, 'onchain', ensRes.at)
    : unavailable<{ name: string; verified: boolean }>('No verified reverse name available.');
  const publicHandle = explorer.value?.ownerName && explorer.value.owner?.toLowerCase() === address.toLowerCase()
    ? sourced(explorer.value.ownerName, explorer.source, explorer.at) : unavailable<string>('No public name for the current owner.');
  const artwork = artRes.value ? sourced(artRes.value, 'onchain', artRes.at) : unavailable<Artwork>('NFT artwork could not be decoded.');
  const acquisition = acquisitionRes.value ? sourced(acquisitionRes.value, 'onchain', acquisitionRes.at)
    : unavailable<Acquisition>('The current owner’s latest receiving Transfer could not be verified.');
  let earnings: Sourced<EarningsSummary>;
  const wallet = earningsSnapshot?.wallets[address.toLowerCase()];
  if (earningRes.value) earnings = sourced(summarizeEarnings(earningRes.value), 'live', earningRes.at,
    earningRes.value.next == null ? null : 'First page of wallet allocations; more records exist on the official API.');
  else if (wallet) earnings = sourced({ ...wallet, complete: false }, 'snapshot', earningsSnapshot?.generatedAt ?? null,
    `Latest ${earningsSnapshot?.latestPerWallet ?? 6} allocations; counts cover the captured API page.`);
  else earnings = unavailable('No wallet allocation record could be loaded.');
  const rankInputs = recordsRes.value
    ? recordsRes.value.seats.map((s) => ({ tokenId: String(s.tokenId), attempts: count(s.attempts), accepted: count(s.accepted) }))
    : seatsSnapshot ? Object.entries(seatsSnapshot.seats).map(([id, s]) => ({ tokenId: id, attempts: count(s.attempts), accepted: count(s.accepted) })) : null;
  const recordsComplete = recordsRes.value ? recordsRes.value.count === recordsRes.value.seats.length : seatsSnapshot?.cohortComplete !== false;
  const ranked = rankInputs && recordsComplete ? computeRank(rankInputs, String(tokenId)) : null;
  const rank = ranked ? sourced(ranked, recordsRes.value ? 'live' : 'snapshot', recordsRes.value ? recordsRes.at : snapshotAt)
    : unavailable<Rank>('A complete ranking cohort is unavailable.');
  const runtime = Array.isArray(standing.value?.presence?.runtimes)
    ? sourced(summarizeRuntimes(standing.value.presence.runtimes), standing.source, standing.at)
    : Array.isArray(seatRes.value?.runtimes) ? sourced(summarizeRuntimes(seatRes.value.runtimes), 'live', seatRes.at)
    : Array.isArray(snapSeat?.runtimes) ? sourced(summarizeRuntimes(snapSeat.runtimes), 'snapshot', snapSeat.detailsAt ?? snapshotAt)
    : unavailable<SeatSummary['runtimes']>('Runtime not reported.');
  const work = Array.isArray(seatRes.value?.work) ? sourced(seatRes.value.work, 'live', seatRes.at)
    : Array.isArray(snapSeat?.work) ? sourced(snapSeat.work, 'snapshot', snapSeat.detailsAt ?? snapshotAt, 'Latest three records in the bundled snapshot.')
    : unavailable<NonNullable<Seat['work']>>('Recent work is not in the available record.');
  const reviews = Array.isArray(seatRes.value?.reviews) ? sourced(seatRes.value.reviews, 'live', seatRes.at)
    : Array.isArray(snapSeat?.reviews) ? sourced(snapSeat.reviews, 'snapshot', snapSeat.detailsAt ?? snapshotAt, 'Latest three reviews in the bundled snapshot.')
    : unavailable<NonNullable<Seat['reviews']>>('Reviews are not in the available record.');
  const liveActivity = newest([standing.value?.presence?.lastHeartbeatAt, standing.value?.enrollment?.lastSeenAt,
    liveRecord?.lastWorkedAt, ...(seatRes.value?.work ?? []).flatMap((w) => [w.submittedAt, w.acceptedAt]), explorerRes.value?.lastAcceptedAt]);
  const lastActivity = liveActivity ? sourced(liveActivity, 'live', new Date().toISOString(), 'Latest reported heartbeat, work or review activity.')
    : snapSeat?.lastWorkedAt ? sourced(snapSeat.lastWorkedAt, 'snapshot', snapshotAt, 'Last work recorded in the snapshot.')
    : unavailable<string>('Activity time not reported.');
  return { tokenId, chainId: 1, onchain, artwork, owner: { address, source: 'onchain' }, acquisition,
    ens, publicHandle, seat, standing, runtime, lastActivity, work, reviews, explorer, explorerPage, earnings, rank,
    cardState: deriveCardState(standing.value, seat.value, seat.source), apiStatus, snapshotAt, fetchedAt: new Date().toISOString() };
}
