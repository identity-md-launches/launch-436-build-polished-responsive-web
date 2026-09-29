// Typed clients for the official IdentityMD public API and Explorer API.
// Shapes were verified against live responses on 2026-09-29; unknown fields are
// kept optional so a server-side change degrades to "Unavailable" instead of
// breaking the page.
//
// Browser access on 2026-09-29: GET /swarm answers with
// Access-Control-Allow-Origin: * and Cache-Control max-age=10, so it is the
// primary live source. /seats/*, /wallets/* and the Explorer API sent no CORS
// header, so those requests can fail in a browser; every caller treats such a
// failure as "use the next source", never as "the field is unavailable".

import { getApiBase, getExplorerBase, OFFICIAL_API_BASE } from './config';
import { getJson, HttpError } from './http';

export interface SeatRuntime {
  id: string;
  version?: string;
  premiumModel?: { model?: string; effort?: string };
}

export interface SeatWorkItem {
  jobId: string;
  objective?: string;
  jobState?: string;
  launch?: unknown;
  nodeKey?: string;
  role?: string;
  submissionHash?: string;
  status?: string;
  submittedAt?: string;
  acceptedAt?: string | null;
}

export interface SeatReview {
  jobId: string;
  nodeKey?: string;
  role?: string;
  value?: number;
  policy?: string;
  verdict?: string;
  submissionHash?: string;
  status?: string;
  txHash?: string | null;
  chainId?: number | null;
  sentAt?: string | null;
}

export interface SeatCollaborator {
  tokenId: string;
  agentId?: string;
  sharedJobs?: number;
}

export interface Seat {
  tokenId: string;
  agentId?: string;
  chainId?: number;
  collection?: string;
  adapter?: string;
  status?: string;
  owner?: string;
  ownership?: string;
  pairedAt?: string;
  online?: boolean;
  daemonVersion?: string;
  runtimes?: SeatRuntime[];
  devices?: number;
  attempts?: number;
  accepted?: number;
  rejected?: number;
  failed?: number;
  pending?: number;
  work?: SeatWorkItem[];
  reviews?: SeatReview[];
  collaboratorJobs?: number;
  collaborators?: SeatCollaborator[];
}

export interface Standing {
  tokenId: string;
  at?: string;
  server?: { version?: string; presenceWindowMs?: number };
  devices?: number;
  enrollment?: {
    status?: string;
    agentId?: string;
    registered?: boolean;
    pairedAt?: string;
    lastSeenAt?: string;
  };
  presence?: {
    connected?: boolean;
    acceptingWork?: boolean;
    connectedAt?: string;
    lastHeartbeatAt?: string;
    heartbeatAgeMs?: number;
    stale?: boolean;
    daemonVersion?: string;
    runtimes?: SeatRuntime[];
    kinds?: string[];
    profiles?: string[];
    skills?: string[];
    maxConcurrency?: number;
    // platform details (os/arch) are private infrastructure data and are never rendered
  };
  standing?: {
    consecutiveFailures?: number;
    lastFailedAt?: string | null;
    pausedUntil?: string | null;
    pausedFor?: string | null;
    working?: number;
    running?: unknown[];
    recentFailures?: unknown[];
  };
  queue?: { ready?: number; fleetOnline?: number; eligible?: number; blocked?: unknown[] };
}

export interface RecordSeat {
  tokenId: string;
  agentId?: string;
  attempts?: number;
  accepted?: number;
  rejected?: number;
  failed?: number;
  pending?: number;
  lastWorkedAt?: string | null;
}

export interface Records {
  count: number;
  seats: RecordSeat[];
}

export interface Earning {
  launchId: string;
  launchNumber?: number;
  status?: string;
  chainId: number;
  kind?: string;
  token?: { address?: string; name?: string; symbol?: string; decimals?: number };
  amount: string;
  at?: string;
}

export interface Earnings {
  wallet: string;
  count: number;
  next?: string | number | null;
  earnings: Earning[];
}

export interface ExplorerAgent {
  tokenId: string;
  online?: boolean;
  owner?: string;
  ownerName?: string | null;
  // Number of identity.md seats the owner wallet holds (matches the /swarm
  // owner list), not a holding duration. Never used for "Held for".
  held?: number;
  attempts?: number;
  accepted?: number;
  jobs?: number;
  lastAcceptedAt?: string | null;
}

/** One seat in GET /swarm (keyed by token ID in `seats`). */
export interface SwarmSeat {
  tokenId: number;
  agentId?: string;
  attempts?: number;
  accepted?: number;
  rejected?: number;
  failed?: number;
  pending?: number;
  last?: string | null;
  working?: boolean;
  queued?: number;
}

export interface SwarmEvent {
  kind?: string;
  at?: string;
  tokenId?: number;
  state?: string;
  step?: string;
  role?: string;
  jobId?: string;
  objective?: string;
  reason?: string | null;
  ensName?: string;
  cid?: string;
}

export interface SwarmHealth {
  reachable?: boolean;
  agentsOnline?: number;
  workingNow?: number;
  acceptedLastDay?: number;
  jobsDoneLastDay?: number;
  seatsEnrolled?: number;
}

export interface Swarm {
  at: number; // epoch milliseconds when the server assembled the snapshot
  health?: SwarmHealth;
  seats: Record<string, SwarmSeat>;
  events: SwarmEvent[];
  owners: (string | null)[]; // index = token ID
  chain?: { chainId?: number; collection?: string };
}

function validateToken<T extends { tokenId: string }>(payload: T, tokenId: number, url: string): T {
  if (!payload || String(payload.tokenId) !== String(tokenId)) {
    throw new HttpError('parse', url, 'The response did not match the requested token');
  }
  return payload;
}

export async function fetchSeat(tokenId: number): Promise<Seat> {
  const url = `${getApiBase()}/seats/${tokenId}`;
  const payload = validateToken(await getJson<Seat>(url), tokenId, url);
  return {
    ...payload,
    runtimes: Array.isArray(payload.runtimes) ? payload.runtimes.filter((r) => r && typeof r.id === 'string') : undefined,
    work: Array.isArray(payload.work) ? payload.work.filter((w) => w && typeof w.jobId === 'string').map((w) => ({
      ...w, objective: typeof w.objective === 'string' ? w.objective : undefined,
    })) : undefined,
    reviews: Array.isArray(payload.reviews) ? payload.reviews.filter((r) => r && typeof r.jobId === 'string') : undefined,
    collaborators: Array.isArray(payload.collaborators) ? payload.collaborators.filter((r) => r && typeof r.tokenId === 'string') : undefined,
  };
}
export async function fetchStanding(tokenId: number): Promise<Standing> {
  const url = `${getApiBase()}/seats/${tokenId}/standing`;
  return validateToken(await getJson<Standing>(url), tokenId, url);
}
export async function fetchRecords(): Promise<Records> {
  const url = `${getApiBase()}/seats/records`;
  const payload = await getJson<Records>(url);
  if (!payload || !Array.isArray(payload.seats)) throw new HttpError('parse', url, 'Work records unavailable');
  payload.seats = payload.seats.filter((seat) => seat && /^(0|[1-9][0-9]*)$/.test(String(seat.tokenId)));
  return payload;
}
export async function fetchEarnings(address: string): Promise<Earnings> {
  const url = `${getApiBase()}/wallets/${address}/earnings`;
  const payload = await getJson<Earnings>(url);
  if (!payload || !Array.isArray(payload.earnings) || payload.wallet?.toLowerCase() !== address.toLowerCase()) {
    throw new HttpError('parse', url, 'Wallet allocations unavailable');
  }
  const valid = payload.earnings.filter((e) => e && typeof e.launchId === 'string' && Number.isSafeInteger(e.chainId)
    && typeof e.amount === 'string' && /^\d+$/.test(e.amount)
    && typeof e.token?.decimals === 'number' && Number.isSafeInteger(e.token.decimals) && e.token.decimals >= 0 && e.token.decimals <= 255);
  return { ...payload, earnings: valid, next: valid.length === payload.earnings.length ? payload.next : 'incomplete' };
}
export async function fetchExplorerAgent(tokenId: number): Promise<ExplorerAgent> {
  const url = `${getExplorerBase()}/api/agents/${tokenId}`;
  const payload = validateToken(await getJson<ExplorerAgent>(url), tokenId, url);
  return { ...payload,
    owner: typeof payload.owner === 'string' && /^0x[0-9a-fA-F]{40}$/.test(payload.owner) ? payload.owner.toLowerCase() : undefined,
    ownerName: typeof payload.ownerName === 'string' && payload.ownerName.trim() ? payload.ownerName.trim() : null,
    lastAcceptedAt: typeof payload.lastAcceptedAt === 'string' ? payload.lastAcceptedAt : null,
  };
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * The whole network in one browser-readable document. The official origin is
 * always tried; a configured first-party base is only a fallback for it.
 */
export async function fetchSwarm(): Promise<Swarm> {
  const bases = [OFFICIAL_API_BASE, getApiBase()].filter((b, i, all) => all.indexOf(b) === i);
  let lastError: unknown = null;
  for (const base of bases) {
    const url = `${base}/swarm`;
    try {
      const payload = await getJson<Partial<Swarm>>(url);
      if (!payload || typeof payload !== 'object' || !payload.seats || typeof payload.seats !== 'object' || Array.isArray(payload.seats)) {
        throw new HttpError('parse', url, 'Swarm document unavailable');
      }
      const seats: Record<string, SwarmSeat> = {};
      for (const [key, raw] of Object.entries(payload.seats)) {
        const seat = raw as SwarmSeat | null;
        if (!seat || typeof seat !== 'object' || !/^(0|[1-9][0-9]*)$/.test(key)) continue;
        if (seat.tokenId !== undefined && String(seat.tokenId) !== key) continue;
        seats[key] = { ...seat, tokenId: Number(key), agentId: typeof seat.agentId === 'string' ? seat.agentId : undefined,
          last: typeof seat.last === 'string' ? seat.last : null };
      }
      const owners = Array.isArray(payload.owners)
        ? payload.owners.map((o) => (typeof o === 'string' && ADDRESS.test(o) ? o.toLowerCase() : null)) : [];
      const events = Array.isArray(payload.events) ? payload.events.filter((e): e is SwarmEvent => !!e && typeof e === 'object') : [];
      const at = typeof payload.at === 'number' && Number.isFinite(payload.at) ? payload.at : Date.now();
      return { at, health: payload.health, seats, events, owners, chain: payload.chain };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
