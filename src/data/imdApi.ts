// Typed clients for the official IdentityMD public API and Explorer API.
// Shapes were taken from live responses on 2026-09-28; unknown fields are
// kept optional so a server-side change degrades to "Unavailable" instead of
// breaking the page.

import { getApiBase, getExplorerBase } from './config';
import { getJson } from './http';

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
  next?: string | null;
  earnings: Earning[];
}

export interface ExplorerAgent {
  tokenId: string;
  online?: boolean;
  owner?: string;
  ownerName?: string | null;
  held?: number;
  attempts?: number;
  accepted?: number;
  jobs?: number;
  lastAcceptedAt?: string | null;
}

export const fetchSeat = (tokenId: number) => getJson<Seat>(`${getApiBase()}/seats/${tokenId}`);
export const fetchStanding = (tokenId: number) => getJson<Standing>(`${getApiBase()}/seats/${tokenId}/standing`);
export const fetchRecords = () => getJson<Records>(`${getApiBase()}/seats/records`);
export const fetchEarnings = (address: string) => getJson<Earnings>(`${getApiBase()}/wallets/${address}/earnings`);
export const fetchExplorerAgent = (tokenId: number) =>
  getJson<ExplorerAgent>(`${getExplorerBase()}/api/agents/${tokenId}`);
