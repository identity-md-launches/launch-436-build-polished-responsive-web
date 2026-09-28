import { useCallback, useEffect, useRef, useState } from 'react';
import { loadProfile, ProfileError, type AgentProfile } from '../data/profile';

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

export function useProfile(tokenId: number): { state: ProfileState; refresh: () => void } {
  const [state, setState] = useState<ProfileState>({ status: 'loading', profile: null });
  const latest = useRef(0);

  const run = useCallback(
    async (force: boolean) => {
      const ticket = ++latest.current;
      setState((prev) =>
        prev.status === 'ready' ? { ...prev, refreshing: true } : { status: 'loading', profile: prev.profile },
      );
      try {
        const profile = await loadProfile(tokenId, { force });
        if (ticket !== latest.current) return;
        setState({ status: 'ready', profile, refreshing: false });
      } catch (error) {
        if (ticket !== latest.current) return;
        const code = error instanceof ProfileError ? error.code : 'unknown';
        const message =
          error instanceof Error && error.message ? error.message : 'Something went wrong while loading this agent.';
        setState((prev) => ({ status: 'error', code, message, profile: prev.profile }));
      }
    },
    [tokenId],
  );

  useEffect(() => {
    void run(false);
  }, [run]);

  const refresh = useCallback(() => {
    void run(true);
  }, [run]);

  return { state, refresh };
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
