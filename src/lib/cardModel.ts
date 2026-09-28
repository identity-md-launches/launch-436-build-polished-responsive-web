// One flat, display-ready model shared by the DOM card and the canvas
// renderer, so the PNG/video exports always show exactly what the page shows.

import { DEFAULT_PALETTE, type Palette } from '../data/artwork';
import { CHAIN_NAME } from '../data/config';
import type { AgentProfile, CardState } from '../data/profile';
import { formatInt, percent, relativeTime, shortAddress } from './format';

export interface CardField {
  label: string;
  value: string;
  unavailable: boolean;
}

export interface CardModel {
  tokenId: number;
  number: string; // "#222"
  name: string; // "identity.md #222"
  state: CardState;
  stateLabel: string;
  verification: string; // "Verified agent" | "Agent (snapshot)" | "Not paired"
  verified: boolean;
  fields: CardField[]; // exactly six: Agent ID, Accepted, Attempts, Acceptance, Runtime, Owner
  network: string;
  lastActivity: string;
  palette: Palette;
  image: string | null;
  imageAlt: string;
  shareUrl: string;
}

export const STATE_LABEL: Record<CardState, string> = {
  working: 'Working',
  ready: 'Online · ready',
  online: 'Online · paused',
  offline: 'Offline',
  unknown: 'Status unavailable',
};

export function buildCardModel(profile: AgentProfile, shareUrl: string): CardModel {
  const seat = profile.seat.value;
  const standing = profile.standing.value;
  const art = profile.artwork.value;
  const palette = art?.palette ?? DEFAULT_PALETTE;

  const ownerLabel =
    profile.ens.value?.name ?? profile.publicHandle.value ?? (profile.owner.address ? shortAddress(profile.owner.address) : 'Unavailable');

  const runtime = seat?.runtimes[0]
    ? `${seat.runtimes[0].id}${seat.runtimes[0].version ? ` ${seat.runtimes[0].version}` : ''}`
    : standing?.presence?.runtimes?.[0]
      ? `${standing.presence.runtimes[0].id}${standing.presence.runtimes[0].version ? ` ${standing.presence.runtimes[0].version}` : ''}`
      : null;

  const verified = profile.seat.source === 'live' && seat?.status === 'active' && !!seat.agentId;
  const verification = verified
    ? 'Verified agent'
    : profile.seat.source === 'snapshot' && seat?.agentId
      ? 'Agent · snapshot'
      : profile.seat.source === 'unavailable' && profile.seat.note?.includes('paired')
        ? 'Not paired'
        : 'Verification unavailable';

  const lastActivityIso =
    standing?.presence?.lastHeartbeatAt ?? seat?.lastWorkedAt ?? profile.explorer.value?.lastAcceptedAt ?? null;

  const fields: CardField[] = [
    { label: 'Agent ID', value: seat?.agentId ?? 'Unavailable', unavailable: !seat?.agentId },
    { label: 'Accepted', value: seat ? formatInt(seat.accepted) : 'Unavailable', unavailable: !seat },
    { label: 'Attempts', value: seat ? formatInt(seat.attempts) : 'Unavailable', unavailable: !seat },
    {
      label: 'Acceptance',
      value: seat && seat.attempts > 0 ? percent(seat.accepted, seat.attempts) : 'Unavailable',
      unavailable: !(seat && seat.attempts > 0),
    },
    { label: 'Runtime', value: runtime ?? 'Unavailable', unavailable: !runtime },
    { label: 'Owner', value: ownerLabel, unavailable: ownerLabel === 'Unavailable' },
  ];

  return {
    tokenId: profile.tokenId,
    number: `#${profile.tokenId}`,
    name: art?.name || `identity.md #${profile.tokenId}`,
    state: profile.cardState,
    stateLabel: STATE_LABEL[profile.cardState],
    verification,
    verified,
    fields,
    network: CHAIN_NAME,
    lastActivity: lastActivityIso ? relativeTime(lastActivityIso) : 'Unavailable',
    palette,
    image: art?.image ?? null,
    imageAlt: art ? `Original onchain artwork for ${art.name || `identity.md #${profile.tokenId}`}` : '',
    shareUrl,
  };
}

export function stateTiming(state: CardState): { orbit: number; pulse: number; scan: number; dim: number } {
  switch (state) {
    case 'working':
      return { orbit: 8, pulse: 1.2, scan: 2.5, dim: 1 };
    case 'ready':
    case 'online':
      return { orbit: 24, pulse: 3.2, scan: 6, dim: 1 };
    case 'offline':
      return { orbit: 48, pulse: 6, scan: 12, dim: 0.72 };
    default:
      return { orbit: 36, pulse: 4.5, scan: 9, dim: 0.85 };
  }
}
