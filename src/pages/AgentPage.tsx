import { useEffect, useMemo, useRef, useState } from 'react';
import { ProfileDialog } from '../components/ProfileDialog';
import { SearchForm } from '../components/SearchForm';
import { SimCard } from '../components/SimCard';
import { CopyButton, SourceTag, StatusBadge } from '../components/common';
import { Toast } from '../components/Chrome';
import type { AgentProfile } from '../data/profile';
import { buildCardModel } from '../lib/cardModel';
import { exportPng, exportVideo, pickVideoMime, xIntentUrl } from '../lib/exports';
import { formatDateTime } from '../lib/format';
import { useProfile, useReducedMotion, useToast } from '../lib/hooks';
import { profileShareUrl } from '../router';

interface Props {
  tokenId: number;
  onSnapshotAt?: (at: string | null) => void;
}

export function AgentPage({ tokenId, onSnapshotAt }: Props) {
  const { state, refresh } = useProfile(tokenId);
  const profile = state.profile;
  const shareUrl = profileShareUrl(tokenId);

  useEffect(() => {
    document.title = `SIMCARD · identity.md #${tokenId}`;
  }, [tokenId]);

  useEffect(() => {
    onSnapshotAt?.(profile?.snapshotAt ?? null);
  }, [profile?.snapshotAt, onSnapshotAt]);

  if (state.status === 'loading' && !profile) {
    return (
      <div className="container stack" aria-busy="true">
        <p className="status-line" role="status">
          <span className="spinner" aria-hidden="true" /> Reading identity.md #{tokenId} from Ethereum and the IdentityMD API…
        </p>
        <div className="skeleton-card" aria-hidden="true" />
      </div>
    );
  }

  if (state.status === 'error' && !profile) {
    const titles: Record<string, string> = {
      'nft-missing': `No identity.md NFT #${tokenId}`,
      'chain-unreachable': 'Unable to reach Ethereum',
      'invalid-token': 'Invalid token ID',
      unknown: 'Unable to build this SIMCARD',
    };
    return (
      <div className="container">
        <section className="state state--error" aria-labelledby="error-title">
          <h2 id="error-title">{titles[state.code] ?? titles.unknown}</h2>
          <p role="alert">{state.message}</p>
          <div className="state__actions">
            <button type="button" className="btn btn--primary" onClick={refresh}>
              Try again
            </button>
            <a className="btn" href="#/">
              Search another token
            </a>
          </div>
          <SearchForm compact />
        </section>
      </div>
    );
  }

  return <LoadedAgent profile={profile as AgentProfile} shareUrl={shareUrl} refreshing={state.status === 'loading' || (state.status === 'ready' && state.refreshing)} onRefresh={refresh} errorMessage={state.status === 'error' ? state.message : null} />;
}

interface LoadedProps {
  profile: AgentProfile;
  shareUrl: string;
  refreshing: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
}

function LoadedAgent({ profile, shareUrl, refreshing, errorMessage, onRefresh }: LoadedProps) {
  const model = useMemo(() => buildCardModel(profile, shareUrl), [profile, shareUrl]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState<'png' | 'video' | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const reducedMotion = useReducedMotion();
  const videoSupported = pickVideoMime() !== null;

  // Page-level accent follows the NFT palette.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--color-accent', model.palette.fill);
    root.setProperty('--color-accent-2', model.palette.secondary);
    root.setProperty('--color-accent-3', model.palette.tertiary);
    root.setProperty('--color-accent-text', model.palette.text);
    return () => {
      ['--color-accent', '--color-accent-2', '--color-accent-3', '--color-accent-text'].forEach((p) => root.removeProperty(p));
    };
  }, [model.palette]);

  useEffect(() => {
    if (errorMessage) toast.show(`Refresh failed: ${errorMessage}`, 'alert');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorMessage]);

  const closeDialog = () => {
    setDialogOpen(false);
    openButtonRef.current?.focus();
  };

  const onPng = async () => {
    setBusy('png');
    try {
      await exportPng(model);
      toast.show(`Saved simcard-${model.tokenId}.png`);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to export the PNG.', 'alert');
    } finally {
      setBusy(null);
    }
  };

  const onVideo = async () => {
    setBusy('video');
    setVideoProgress(0);
    try {
      const ext = await exportVideo(model, { onProgress: setVideoProgress });
      toast.show(`Saved simcard-${model.tokenId}.${ext} (6 s loop). Attach it manually when posting on X.`);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to record the video.', 'alert');
    } finally {
      setBusy(null);
    }
  };

  const apiNote =
    profile.apiStatus === 'live'
      ? null
      : profile.apiStatus === 'offline'
        ? 'You appear to be offline. Showing cached and snapshot values.'
        : profile.apiStatus === 'blocked'
          ? `The official API blocks cross-origin browser requests, so work stats come from the snapshot${profile.snapshotAt ? ` taken ${formatDateTime(profile.snapshotAt)}` : ''} and live presence is unavailable. Artwork, ownership and ENS are read directly from Ethereum.`
          : 'The official API returned an error. Some values may be unavailable.';

  return (
    <div className="container agent-layout">
      <div className="stack" style={{ gap: 'var(--space-5)' }}>
        <h1 className="page-title">SIMCARD · identity.md {model.number}</h1>
        <div className="status-line">
          <StatusBadge state={model.state} />
          <span>
            Seat data <SourceTag source={profile.seat.source} at={profile.seat.at} note={profile.seat.note} />
          </span>
          <span>
            Presence <SourceTag source={profile.standing.source} at={profile.standing.at} note={profile.standing.note} />
          </span>
          <span>
            Artwork <SourceTag source={profile.artwork.source} at={profile.artwork.at} note={profile.artwork.note} />
          </span>
        </div>
        <SimCard model={model} onOpen={() => setDialogOpen(true)} staticRender={reducedMotion} />
        {apiNote ? <p className="note note--warn">{apiNote}</p> : null}
        {reducedMotion ? <p className="note">Card animation is paused because your system prefers reduced motion. Exports still animate.</p> : null}
      </div>

      <aside className="agent-side" aria-label="Card actions">
        <section className="panel">
          <h2>Actions</h2>
          <div className="actions">
            <button ref={openButtonRef} type="button" className="btn btn--primary" onClick={() => setDialogOpen(true)}>
              Open profile
            </button>
            <button type="button" className="btn" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing}>
              {refreshing ? <span className="spinner" aria-hidden="true" /> : null}
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
            <button type="button" className="btn" onClick={onPng} disabled={busy !== null} aria-busy={busy === 'png'}>
              {busy === 'png' ? <span className="spinner" aria-hidden="true" /> : null}
              Download PNG
            </button>
            <button type="button" className="btn" onClick={onVideo} disabled={busy !== null || !videoSupported} aria-busy={busy === 'video'} aria-describedby="video-note">
              {busy === 'video' ? <span className="spinner" aria-hidden="true" /> : null}
              {busy === 'video' ? `Recording ${Math.round(videoProgress * 100)}%` : 'Download video'}
            </button>
            <a className="btn" href={xIntentUrl(model)} target="_blank" rel="noopener noreferrer">
              Share on X
            </a>
          </div>
          <p id="video-note" className="note">
            {videoSupported
              ? 'Video export records one 6-second loop of the animated card in your browser (WebM, or MP4 where the browser supports it).'
              : 'This browser cannot record canvas video. Use Chrome, Edge or Firefox for the video export.'}
          </p>
          <p className="note">
            “Share on X” opens a post with a caption and this profile link. X cannot attach the video automatically without
            API access: download the video first, then attach the file to the post yourself.
          </p>
        </section>

        <section className="panel">
          <h2>Share link</h2>
          <div className="share-url">
            <span className="share-url__value" title={shareUrl}>
              {shareUrl}
            </span>
            <CopyButton text={shareUrl} label="Copy profile link" />
          </div>
          <p className="note">The same link is encoded in the card’s QR code.</p>
        </section>

        <section className="panel">
          <h2>Another token</h2>
          <SearchForm compact />
        </section>
      </aside>

      <ProfileDialog profile={profile} model={model} open={dialogOpen} onClose={closeDialog} />
      <Toast message={toast.message} kind={toast.kind} onDismiss={toast.clear} />
    </div>
  );
}
