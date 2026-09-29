// Public data is kept with its source and observation time. Missing values
// stay null; a failed endpoint never discards successful sibling requests.
//
// Field priority (highest first): live /swarm (Live IMD), the Explorer agent
// endpoint, Ethereum reads, the last successful live read kept in memory, the
// bundled snapshot, and only then "Unavailable" for that one field. Ownership,
// artwork and acquisition history stay onchain-first because the chain is the
// authority for them; the public APIs only fill in when Ethereum cannot be read.
import { loadArtwork, type Artwork } from './artwork';
import { cached } from './cache';
import { readAcquisition, readToken, reverseEns, type Acquisition, type OnchainToken } from './chain';
import { MAX_TOKEN_ID, MIN_TOKEN_ID } from './config';
import { isHttpError } from './http';
import {
  fetchEarnings, fetchExplorerAgent, fetchRecords, fetchSeat, fetchStanding, fetchSwarm,
  type Earnings, type ExplorerAgent, type Records, type Seat, type SeatCollaborator, type SeatReview, type SeatRuntime,
  type SeatWorkItem, type Standing, type Swarm, type SwarmEvent, type SwarmSeat,
} from './imdApi';
import { computeRank, type Rank } from './rank';
import { loadEarningsSnapshot, loadSeatsSnapshot, type EarningsSnapshot, type SeatsSnapshot, type SnapshotAllocation, type SnapshotSeat } from './snapshot';

export type Provenance = 'live' | 'explorer' | 'onchain' | 'snapshot' | 'unavailable';
export interface Sourced<T> {
  value: T | null;
  source: Provenance;
  at: string | null;
  note: string | null;
}
export type CardState = 'working' | 'ready' | 'online' | 'offline' | 'unknown';
export type ApiStatus = 'live' | 'blocked' | 'offline' | 'error';
export type LoadMode = 'initial' | 'refresh' | 'poll';
export interface Runtime { id: string; version: string | null; model: string | null }
export interface Stats {
  attempts: Sourced<number>;
  accepted: Sourced<number>;
  rejected: Sourced<number>;
  failed: Sourced<number>;
  pending: Sourced<number>;
  jobs: Sourced<number>;
}
export interface Presence {
  state: CardState;
  source: Provenance;
  at: string | null;
  working: Sourced<boolean>;
  queued: Sourced<number>;
  explorerOnline: Sourced<boolean>;
  acceptingWork: Sourced<boolean>;
  lastHeartbeatAt: Sourced<string>;
}
export interface NetworkHealth { agentsOnline: number | null; workingNow: number | null; seatsEnrolled: number | null }
export interface EarningsSummary {
  count: number;
  byChain: Record<string, number>;
  byKind: Record<string, number>;
  byStatus: Record<string, number>;
  latest: SnapshotAllocation[];
  complete: boolean;
}
/** Live polling bookkeeping shown by the "Live · updated …" indicator. */
export interface LiveMeta {
  at: string | null; // last successful live read (swarm or Explorer)
  swarmAt: string | null; // last successful /swarm read, retained during failures
  ok: boolean; // whether the most recent attempt succeeded
  attemptedAt: string;
}
export interface AgentProfile {
  tokenId: number;
  chainId: number;
  onchain: OnchainToken;
  chainReachable: boolean;
  artwork: Sourced<Artwork>;
  owner: Sourced<string>;
  acquisition: Sourced<Acquisition>;
  ens: Sourced<{ name: string; verified: boolean }>;
  publicHandle: Sourced<string>;
  ownerSeats: Sourced<number>;
  agentId: Sourced<string>;
  stats: Stats;
  presence: Presence;
  lastActivity: Sourced<string>;
  runtime: Sourced<Runtime[]>;
  network: Sourced<NetworkHealth>;
  events: Sourced<SwarmEvent[]>;
  work: Sourced<SeatWorkItem[]>;
  reviews: Sourced<SeatReview[]>;
  collaborators: Sourced<SeatCollaborator[]>;
  earnings: Sourced<EarningsSummary>;
  rank: Sourced<Rank>;
  cardState: CardState;
  apiStatus: ApiStatus;
  live: LiveMeta;
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
const bool = (b: unknown): boolean | null => typeof b === 'boolean' ? b : null;
const text = (s: unknown): string | null => typeof s === 'string' && s.trim() ? s : null;
function validDate(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}
function newest(values: unknown[]): string | null {
  return values.map(validDate).filter((x): x is string => x !== null).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}
type Candidate<T> = [T | null | undefined, Provenance, string | null, string?];
/** First candidate with a value wins; the label records where it came from. */
function pick<T>(candidates: Candidate<T>[], note: string): Sourced<T> {
  for (const [value, source, at, hint] of candidates) if (value !== null && value !== undefined) return sourced(value, source, at, hint ?? null);
  return unavailable<T>(note);
}
interface Result<T> { value: T | null; error: unknown; at: string }
async function attempt<T>(loader: () => Promise<T>): Promise<Result<T>> {
  try { return { value: await loader(), error: null, at: new Date().toISOString() }; }
  catch (error) { return { value: null, error, at: new Date().toISOString() }; }
}
const skipped = (): Result<never> => ({ value: null, error: null, at: new Date().toISOString() });

// Endpoints that the browser could not reach (usually a missing CORS header)
// are not retried on every 10-second poll; a manual Refresh or five minutes
// clears the block so a fixed endpoint is picked up again.
const BLOCK_MS = 5 * 60_000;
const blockedUntil = new Map<string, number>();
async function guarded<T>(kind: string, mode: LoadMode, loader: () => Promise<T>): Promise<Result<T>> {
  if (mode === 'refresh') blockedUntil.delete(kind);
  if (mode === 'poll' && (blockedUntil.get(kind) ?? 0) > Date.now()) return skipped();
  const result = await attempt(loader);
  if (isHttpError(result.error, 'unreachable')) blockedUntil.set(kind, Date.now() + BLOCK_MS);
  else blockedUntil.delete(kind);
  return result;
}

// Last successful live reads. During a temporary failure the previous values
// stay on screen with their original observation time instead of flipping to
// "Unavailable", and the indicator shows that the refresh is retrying.
interface Remembered<T> { value: T; at: string }
let lastSwarm: Remembered<Swarm> | null = null;
let lastRecords: Remembered<Records> | null = null;
const lastExplorer = new Map<number, Remembered<ExplorerAgent>>();
const lastStanding = new Map<number, Remembered<Standing>>();
function remember<T>(store: Remembered<T> | null, result: Result<T>): Remembered<T> | null {
  return result.value ? { value: result.value, at: result.at } : store;
}

// Slow, mostly static reads are made on full loads and kept for polls.
interface StaticData {
  onchain: Result<OnchainToken>;
  ens: Result<{ name: string | null; verified: boolean }>;
  artwork: Result<Artwork | null>;
  acquisition: Result<Acquisition | null>;
  earnings: Result<Earnings>;
  seat: Result<Seat>;
  seatsSnapshot: SeatsSnapshot | null;
  earningsSnapshot: EarningsSnapshot | null;
}
const staticByToken = new Map<number, StaticData>();

function summarizeRuntimes(runtimes: SeatRuntime[] | undefined): Runtime[] | null {
  if (!Array.isArray(runtimes)) return null;
  return runtimes.filter((r) => r && typeof r.id === 'string').map((r) => ({ id: r.id, version: r.version ?? null, model: r.premiumModel?.model ?? null }));
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

interface PresenceInputs {
  standing: Sourced<Standing>;
  swarmSeat: Sourced<SwarmSeat>;
  explorer: Sourced<ExplorerAgent>;
}
/**
 * Presence is only ever taken from live sources. /swarm reports whether the
 * seat is working right now; the Explorer reports whether it is online; the
 * standing endpoint (when reachable) reports the full heartbeat. A bundled
 * snapshot's online flag is stale by definition and never decides the state.
 */
export function derivePresence({ standing, swarmSeat, explorer }: PresenceInputs): Presence {
  const seat = swarmSeat.value, st = standing.value, ex = explorer.value;
  const working = pick<boolean>([[bool(seat?.working), swarmSeat.source, swarmSeat.at],
    [st?.standing ? (st.standing.working ?? 0) > 0 || (st.standing.running?.length ?? 0) > 0 : null, standing.source, standing.at]], 'Not reported by the live network view.');
  const queued = pick<number>([[count(seat?.queued), swarmSeat.source, swarmSeat.at]], 'Not reported by the live network view.');
  const explorerOnline = pick<boolean>([[bool(ex?.online), explorer.source, explorer.at]], 'The Explorer did not report presence.');
  const acceptingWork = pick<boolean>([[bool(st?.presence?.acceptingWork), standing.source, standing.at]], 'Only reported by the standing endpoint.');
  const lastHeartbeatAt = pick<string>([[validDate(st?.presence?.lastHeartbeatAt), standing.source, standing.at]], 'Only reported by the standing endpoint.');
  let state: CardState = 'unknown', source: Provenance = 'unavailable', at: string | null = null;
  if (working.value === true) { state = 'working'; source = working.source; at = working.at; }
  else if (st?.presence && (st.presence.connected === false || st.presence.stale === true)) { state = 'offline'; source = standing.source; at = standing.at; }
  else if (st?.presence?.connected === true && st.presence.stale === false) { state = st.presence.acceptingWork === true ? 'ready' : 'online'; source = standing.source; at = standing.at; }
  else if (explorerOnline.value !== null) { state = explorerOnline.value ? 'online' : 'offline'; source = explorerOnline.source; at = explorerOnline.at; }
  else if (working.value === false) { source = working.source; at = working.at; }
  return { state, source, at, working, queued, explorerOnline, acceptingWork, lastHeartbeatAt };
}

function classifyApi(errors: unknown[]): ApiStatus {
  if (!errors.length) return 'live';
  if (errors.some((e) => isHttpError(e, 'unreachable') || isHttpError(e, 'timeout'))) {
    return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'blocked';
  }
  return 'error';
}

async function loadStatic(tokenId: number, force: boolean): Promise<StaticData> {
  const [onchain, seat, seatsSnapshotRes, earningsSnapshotRes] = await Promise.all([
    attempt(() => cached(`onchain:${tokenId}`, () => readToken(tokenId), { force })),
    guarded('seat', force ? 'refresh' : 'initial', () => fetchSeat(tokenId)),
    attempt(loadSeatsSnapshot), attempt(loadEarningsSnapshot),
  ]);
  const address = onchain.value?.owner ?? null;
  const [ens, artwork, earnings, acquisition] = address ? await Promise.all([
    attempt(() => cached(`ens:${address}`, () => reverseEns(address), { force })),
    attempt(() => onchain.value?.tokenURI ? loadArtwork(onchain.value.tokenURI) : Promise.resolve(null)),
    guarded('earnings', force ? 'refresh' : 'initial', () => fetchEarnings(address)),
    attempt(() => readAcquisition(tokenId, address)),
  ]) : [skipped(), skipped(), skipped(), skipped()];
  return { onchain, ens, artwork, acquisition, earnings, seat, seatsSnapshot: seatsSnapshotRes.value, earningsSnapshot: earningsSnapshotRes.value };
}

export async function loadProfile(tokenId: number, { mode = 'initial' }: { mode?: LoadMode } = {}): Promise<AgentProfile> {
  if (parseTokenId(String(tokenId)) === null) throw new ProfileError('invalid-token', 'Enter a valid IdentityMD token ID.');
  const previous = staticByToken.get(tokenId);
  const effectiveMode: LoadMode = mode === 'poll' && !previous ? 'initial' : mode;
  // Live reads happen on every load and every poll; nothing here is cached
  // client-side, so a value labelled Live IMD was read from the API just now.
  const [staticData, swarmRes, explorerRes, standingRes] = await Promise.all([
    effectiveMode === 'poll' && previous ? Promise.resolve(previous) : loadStatic(tokenId, effectiveMode === 'refresh'),
    attempt(fetchSwarm),
    guarded('explorer', effectiveMode, () => fetchExplorerAgent(tokenId)),
    guarded('standing', effectiveMode, () => fetchStanding(tokenId)),
  ]);
  // Work records are only a fallback for statistics and rankings.
  const recordsRes: Result<Records> = swarmRes.value ? skipped() : await guarded('records', effectiveMode, fetchRecords);
  staticByToken.set(tokenId, staticData);
  lastSwarm = remember(lastSwarm, swarmRes);
  lastRecords = remember(lastRecords, recordsRes);
  if (explorerRes.value) lastExplorer.set(tokenId, { value: explorerRes.value, at: explorerRes.at });
  if (standingRes.value) lastStanding.set(tokenId, { value: standingRes.value, at: standingRes.at });

  const onchain: OnchainToken = staticData.onchain.value ?? { owner: null, tokenURI: null, hasIdentityHash: null, identityHash: null, identityHashLocked: null, totalSupply: null };
  const chainReachable = staticData.onchain.value !== null;
  if (chainReachable && !onchain.owner) throw new ProfileError('nft-missing', `identity.md #${tokenId} has not been minted or does not exist onchain.`);

  const retained = 'Last successful live read; a newer refresh has not completed.';
  const swarmMem = lastSwarm, swarmLive = swarmRes.value !== null;
  const swarm: Sourced<Swarm> = swarmMem ? sourced(swarmMem.value, 'live', swarmMem.at, swarmLive ? null : retained) : unavailable('The live network view could not be read.');
  const swarmSeatValue = swarm.value?.seats[String(tokenId)] ?? null;
  const swarmSeat: Sourced<SwarmSeat> = swarmSeatValue ? sourced(swarmSeatValue, 'live', swarm.at, swarm.note)
    : swarm.value ? unavailable('This NFT is not enrolled as an agent in the live network view.') : unavailable(swarm.note ?? 'Unavailable.');
  const explorerMem = lastExplorer.get(tokenId) ?? null;
  const explorer: Sourced<ExplorerAgent> = explorerMem ? sourced(explorerMem.value, 'explorer', explorerMem.at, explorerRes.value ? null : retained)
    : isHttpError(explorerRes.error, 'not-found') ? unavailable('The Explorer has no record of this NFT.') : unavailable('The Explorer could not be read from this browser.');
  const standingMem = lastStanding.get(tokenId) ?? null;
  const standing: Sourced<Standing> = standingMem ? sourced(standingMem.value, 'live', validDate(standingMem.value.at) ?? standingMem.at, standingRes.value ? null : retained)
    : unavailable('Live heartbeat not readable from this browser.');
  const recordsMem = lastRecords;
  const records: Sourced<Records> = recordsMem ? sourced(recordsMem.value, 'live', recordsMem.at, 'From the public work records.') : unavailable('Work records unavailable.');
  const record = records.value?.seats.find((s) => String(s.tokenId) === String(tokenId)) ?? null;
  const seatDetail = staticData.seat.value;
  const seatDetailAt = staticData.seat.at;
  const seatsSnapshot = staticData.seatsSnapshot, earningsSnapshot = staticData.earningsSnapshot;
  const snapshotAt = seatsSnapshot?.generatedAt ?? null;
  const snap: SnapshotSeat | null = seatsSnapshot?.seats[String(tokenId)] ?? null;
  const snapAt = snap?.detailsAt ?? snapshotAt;
  const snapNote = 'From the bundled snapshot; it does not update itself.';

  // Ownership: Ethereum first. Only when the chain cannot be read do the public APIs fill in.
  const owner = pick<string>([[onchain.owner, 'onchain', staticData.onchain.at],
    [swarm.value?.owners[tokenId] ?? null, 'live', swarm.at, 'Ethereum could not be read; owner reported by the live network view.'],
    [explorer.value?.owner ?? null, 'explorer', explorer.at, 'Ethereum could not be read; owner reported by the Explorer.'],
    [snap?.owner ?? null, 'snapshot', snapAt, snapNote]], chainReachable ? 'No owner recorded.' : 'Ethereum could not be read.');
  const knownAnywhere = !!(swarmSeatValue || explorer.value || snap || record || seatDetail || owner.value);
  if (!chainReachable && !knownAnywhere) throw new ProfileError('chain-unreachable', 'Unable to read the NFT from Ethereum. Check your connection and try again.');
  const address = owner.value;
  const ensValue = staticData.ens.value;
  const ens = ensValue?.name ? sourced({ name: ensValue.name, verified: ensValue.verified }, 'onchain', staticData.ens.at)
    : unavailable<{ name: string; verified: boolean }>(chainReachable ? 'No verified reverse name available.' : 'Ethereum could not be read.');
  const handleOwner = explorer.value?.owner ?? snap?.owner ?? null;
  const handleName = text(explorer.value?.ownerName) ?? (explorer.value ? null : text(snap?.ownerName));
  const publicHandle = handleName && address && handleOwner?.toLowerCase() === address.toLowerCase()
    ? sourced(handleName, explorer.value ? 'explorer' : 'snapshot', explorer.value ? explorer.at : snapAt) : unavailable<string>('No public name for the current owner.');
  const ownerSeats = pick<number>([[count(explorer.value?.held), 'explorer', explorer.at],
    [address && swarm.value?.owners.length ? swarm.value.owners.filter((o) => o === address.toLowerCase()).length : null, 'live', swarm.at]], 'Not reported.');
  const artwork = staticData.artwork.value ? sourced(staticData.artwork.value, 'onchain', staticData.artwork.at)
    : unavailable<Artwork>(chainReachable ? 'NFT artwork could not be decoded.' : 'Ethereum could not be read, so the original artwork is unavailable.');
  const acquisition = staticData.acquisition.value ? sourced(staticData.acquisition.value, 'onchain', staticData.acquisition.at)
    : unavailable<Acquisition>('The current owner’s latest receiving Transfer could not be verified.');

  // Agent identity and statistics, field by field.
  const agentId = pick<string>([[text(swarmSeatValue?.agentId), 'live', swarmSeat.at, swarmSeat.note ?? undefined],
    [text(standing.value?.enrollment?.agentId), 'live', standing.at], [text(seatDetail?.agentId), 'live', seatDetailAt],
    [text(record?.agentId), 'live', records.at, records.note ?? undefined], [text(snap?.agentId), 'snapshot', snapAt, snapNote]],
  swarm.value && !swarmSeatValue ? 'This NFT is not paired with an agent.' : 'No public agent ID reported.');
  const stat = (key: 'attempts' | 'accepted' | 'rejected' | 'failed' | 'pending'): Sourced<number> => pick<number>([
    [count(swarmSeatValue?.[key]), 'live', swarmSeat.at, swarmSeat.note ?? undefined],
    [key === 'attempts' || key === 'accepted' ? count(explorer.value?.[key]) : null, 'explorer', explorer.at, explorer.note ?? undefined],
    [count(seatDetail?.[key]), 'live', seatDetailAt], [count(record?.[key]), 'live', records.at, records.note ?? undefined],
    [count(snap?.[key]), 'snapshot', snapAt, snapNote],
  ], 'This count was not reported.');
  const stats: Stats = { attempts: stat('attempts'), accepted: stat('accepted'), rejected: stat('rejected'), failed: stat('failed'), pending: stat('pending'),
    jobs: pick<number>([[count(explorer.value?.jobs), 'explorer', explorer.at]], 'Not reported by the Explorer.') };

  const presence = derivePresence({ standing, swarmSeat, explorer });
  const lastActivity = pick<string>([
    [newest([standing.value?.presence?.lastHeartbeatAt, standing.value?.enrollment?.lastSeenAt]), 'live', standing.at, 'Latest heartbeat.'],
    [validDate(swarmSeatValue?.last), 'live', swarmSeat.at, 'Latest work activity in the live network view.'],
    [validDate(explorer.value?.lastAcceptedAt), 'explorer', explorer.at, 'Latest accepted work.'],
    [newest([record?.lastWorkedAt, ...(seatDetail?.work ?? []).flatMap((w) => [w.submittedAt, w.acceptedAt])]), 'live', seatDetail ? seatDetailAt : records.at],
    [validDate(snap?.lastWorkedAt), 'snapshot', snapAt, snapNote]], 'Activity time not reported.');
  const runtime = pick<Runtime[]>([[summarizeRuntimes(standing.value?.presence?.runtimes), 'live', standing.at],
    [summarizeRuntimes(seatDetail?.runtimes), 'live', seatDetailAt], [summarizeRuntimes(snap?.runtimes), 'snapshot', snapAt, snapNote]], 'Runtime not reported.');
  const network = swarm.value?.health ? sourced<NetworkHealth>({ agentsOnline: count(swarm.value.health.agentsOnline), workingNow: count(swarm.value.health.workingNow),
    seatsEnrolled: count(swarm.value.health.seatsEnrolled) }, 'live', swarm.at, swarm.note) : unavailable<NetworkHealth>('Network totals unavailable.');
  const events = swarm.value ? sourced(swarm.value.events.filter((e) => e.tokenId === tokenId).slice(0, 5), 'live', swarm.at, swarm.note)
    : unavailable<SwarmEvent[]>('Recent network events unavailable.');
  const work = pick<SeatWorkItem[]>([[Array.isArray(seatDetail?.work) ? seatDetail.work : null, 'live', seatDetailAt],
    [Array.isArray(snap?.work) ? snap.work : null, 'snapshot', snapAt, 'Latest three records in the bundled snapshot.']], 'Recent work is not readable from this browser.');
  const reviews = pick<SeatReview[]>([[Array.isArray(seatDetail?.reviews) ? seatDetail.reviews : null, 'live', seatDetailAt],
    [Array.isArray(snap?.reviews) ? snap.reviews : null, 'snapshot', snapAt, 'Latest three reviews in the bundled snapshot.']], 'Reviews are not readable from this browser.');
  const collaborators = pick<SeatCollaborator[]>([[Array.isArray(seatDetail?.collaborators) ? seatDetail.collaborators : null, 'live', seatDetailAt]], 'Not reported.');

  let earnings: Sourced<EarningsSummary>;
  const wallet = address ? earningsSnapshot?.wallets[address.toLowerCase()] : undefined;
  const earningRes = staticData.earnings;
  if (earningRes.value) earnings = sourced(summarizeEarnings(earningRes.value), 'live', earningRes.at,
    earningRes.value.next == null ? null : 'First page of wallet allocations; more records exist on the official API.');
  else if (wallet) earnings = sourced({ ...wallet, complete: false }, 'snapshot', earningsSnapshot?.generatedAt ?? null,
    `Latest ${earningsSnapshot?.latestPerWallet ?? 6} allocations; counts cover the captured API page.`);
  else earnings = unavailable('No wallet allocation record could be loaded.');

  // Rankings need a complete cohort: every enrolled seat in /swarm, else the
  // complete work records, else the bundled snapshot when it was complete.
  let rank: Sourced<Rank> = unavailable('A complete ranking cohort is unavailable.');
  const cohorts: Candidate<Rank>[] = [];
  if (swarm.value) cohorts.push([computeRank(Object.values(swarm.value.seats).map((s) => ({ tokenId: String(s.tokenId), attempts: count(s.attempts), accepted: count(s.accepted) })), String(tokenId)), 'live', swarm.at, swarm.note ?? undefined]);
  if (records.value && records.value.count === records.value.seats.length) cohorts.push([computeRank(records.value.seats.map((s) => ({ tokenId: String(s.tokenId), attempts: count(s.attempts), accepted: count(s.accepted) })), String(tokenId)), 'live', records.at, 'From the public work records.']);
  if (seatsSnapshot && seatsSnapshot.cohortComplete !== false) cohorts.push([computeRank(Object.entries(seatsSnapshot.seats).map(([id, s]) => ({ tokenId: id, attempts: count(s.attempts), accepted: count(s.accepted) })), String(tokenId)), 'snapshot', snapshotAt, snapNote]);
  if (cohorts.length) rank = pick(cohorts, agentId.value ? 'A complete ranking cohort is unavailable.' : 'Only enrolled agents are ranked.');

  const liveOk = swarmRes.value !== null || explorerRes.value !== null;
  const liveAt = newest([swarmRes.value ? swarmRes.at : null, explorerRes.value ? explorerRes.at : null, swarmMem?.at, explorerMem?.at]);
  const apiStatus = swarmLive ? 'live' : classifyApi([swarmRes.error, explorerRes.error, recordsRes.error].filter((e) => e && !isHttpError(e, 'not-found')));
  return { tokenId, chainId: 1, onchain, chainReachable, artwork, owner, acquisition, ens, publicHandle, ownerSeats, agentId, stats, presence,
    lastActivity, runtime, network, events, work, reviews, collaborators, earnings, rank, cardState: presence.state, apiStatus,
    live: { at: liveAt, swarmAt: swarmMem?.at ?? null, ok: liveOk, attemptedAt: swarmRes.at }, snapshotAt, fetchedAt: new Date().toISOString() };
}
