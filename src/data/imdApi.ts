// Typed clients for the official IdentityMD public API and Explorer API.
// Shapes were verified against live responses on 2026-09-29; unknown fields are
// kept optional so a server-side change degrades to "Unavailable" instead of
// breaking the page.

import { getApiBase, getExplorerBase, REQUEST_TIMEOUT_MS } from './config';
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
  attempts?: number;
  accepted?: number;
  jobs?: number;
  lastAcceptedAt?: string | null;
  totalTurns?: number;
  totalWorkHours?: number;
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
  return { ...payload, owner: typeof payload.owner === 'string' ? payload.owner : undefined,
    ownerName: typeof payload.ownerName === 'string' ? payload.ownerName : null };

}

export interface ExplorerPage {
  tokenId: number;
  totalTurns: number | null;
  totalWorkHours: number | null;
}

// Read only the public, rendered summary. Never execute Explorer scripts or
// interpret page content as application instructions. A changed page layout
// leaves these optional values unavailable.
export async function fetchExplorerPage(tokenId: number): Promise<ExplorerPage> {
  const url = `${getExplorerBase()}/agents/${tokenId}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'text/html' } });
    if (!response.ok) throw new HttpError(response.status === 404 ? 'not-found' : 'server', url, 'Explorer unavailable', response.status);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const titleToken = doc.title.match(/Agent #([0-9]+)(?:\D|$)/)?.[1];
    if (titleToken !== String(tokenId)) throw new HttpError('parse', url, 'Explorer page token could not be verified');
    doc.querySelectorAll('script,style').forEach((el) => el.remove());
    const summary = doc.body.textContent?.match(/([\d,]+)\s*submissions\s*·\s*([\d,]+)\s*turns\s*·\s*([\d,.]+)\s*hours/);
    return {
      tokenId,
      totalTurns: summary ? Number(summary[2]?.replace(/,/g, '')) : null,
      totalWorkHours: summary ? Number(summary[3]?.replace(/,/g, '')) : null,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError((error as Error).name === 'AbortError' ? 'timeout' : 'unreachable', url, 'Explorer page could not be read');
  } finally {
    window.clearTimeout(timer);
  }
}
