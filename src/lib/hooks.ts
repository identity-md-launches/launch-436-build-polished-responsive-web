import { useCallback, useEffect, useRef, useState } from 'react';
import { LIVE_REFRESH_MS } from '../data/config';
import { loadProfile, ProfileError, type AgentProfile, type LoadMode } from '../data/profile';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export type ProfileState =
  | { status: 'loading'; profile: AgentProfile | null }
  | { status: 'ready'; profile: AgentProfile; refreshing: boolean }
  | { status: 'error'; code: ProfileError['code'] | 'unknown'; message: string; profile: AgentProfile | null };

/**
 * Loads a profile, then polls the live sources every LIVE_REFRESH_MS while
 * the tab is visible. A poll never replaces the profile on screen with an
 * error: when it fails, the last valid values stay and the indicator shows
 * that the refresh is retrying. Refresh (manual) re-reads everything.
 */
export function useProfile(tokenId: number): { state: ProfileState; refresh: () => void } {
  const [state, setState] = useState<ProfileState>({ status: 'loading', profile: null });
  const latest = useRef(0);
  const inFlight = useRef(false);
  const hasProfile = useRef(false);

  const run = useCallback(
    async (mode: LoadMode) => {
      if (mode === 'poll' && (inFlight.current || !hasProfile.current)) return;
      const ticket = ++latest.current;
      inFlight.current = true;
      if (mode !== 'poll') {
        setState((prev) => prev.status === 'ready' ? { ...prev, refreshing: true } : { status: 'loading', profile: prev.profile });
      }
      try {
        const profile = await loadProfile(tokenId, { mode });
        if (ticket !== latest.current) return;
        hasProfile.current = true;
        setState({ status: 'ready', profile, refreshing: false });
      } catch (error) {
        if (ticket !== latest.current || mode === 'poll') return;
        const code = error instanceof ProfileError ? error.code : 'unknown';
        const message =
          error instanceof Error && error.message ? error.message : 'Something went wrong while loading this agent.';
        setState((prev) => ({ status: 'error', code, message, profile: prev.profile }));
      } finally {
        if (ticket === latest.current) inFlight.current = false;
      }
    },
    [tokenId],
  );

  useEffect(() => {
    hasProfile.current = false;
    void run('initial');
  }, [run]);

  useEffect(() => {
    let timer: number | null = null;
    const stop = () => { if (timer !== null) window.clearInterval(timer); timer = null; };
    const start = () => { stop(); timer = window.setInterval(() => { void run('poll'); }, LIVE_REFRESH_MS); };
    const onVisibility = () => {
      if (document.hidden) stop();
      else { void run('poll'); start(); }
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [run]);

  const refresh = useCallback(() => {
    void run('refresh');
  }, [run]);

  return { state, refresh };
}

/** Re-renders on an interval so relative times ("4 s ago") stay current. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Small polite live region helper for one-off status messages. */
export function useToast(): { message: string | null; kind: 'status' | 'alert'; show: (m: string, kind?: 'status' | 'alert') => void; clear: () => void } {
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<'status' | 'alert'>('status');
  const timer = useRef<number | null>(null);
  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setMessage(null);
  }, []);
  const show = useCallback(
    (m: string, k: 'status' | 'alert' = 'status') => {
      if (timer.current) window.clearTimeout(timer.current);
      setKind(k);
      setMessage(m);
      // Errors stay until dismissed; routine notices clear themselves.
      if (k === 'status') timer.current = window.setTimeout(() => setMessage(null), 6000);
    },
    [],
  );
  return { message, kind, show, clear };
}
