import { useEffect, useState } from 'react';
import { parseTokenId } from './data/profile';

export type Route = { name: 'home' } | { name: 'agent'; tokenId: number } | { name: 'invalid'; raw: string };

export function agentHash(tokenId: number): string {
  return `#/agent/${tokenId}`;
}

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!clean) return { name: 'home' };
  const m = /^agent\/(.+)$/.exec(clean);
  if (!m) return { name: 'invalid', raw: clean };
  const tokenId = parseTokenId(decodeURIComponent(m[1] ?? ''));
  return tokenId === null ? { name: 'invalid', raw: m[1] ?? '' } : { name: 'agent', tokenId };
}

/**
 * Static hosts (IPFS gateways) cannot rewrite /agent/222 to the app, so the
 * canonical shareable URL is hash based. When a host does serve the path
 * form, or a link uses ?agent=222, fold it into the hash so one URL scheme
 * remains.
 */
export function normalizeEntryUrl(): void {
  const { pathname, search, hash } = window.location;
  if (hash && hash !== '#' && hash !== '#/') return;
  const fromPath = /\/agent\/([^/?#]+)\/?$/.exec(pathname);
  const fromQuery = new URLSearchParams(search).get('agent');
  const raw = fromPath?.[1] ?? fromQuery;
  if (!raw) return;
  const base = fromPath ? pathname.slice(0, pathname.length - fromPath[0].length + 1) : pathname;
  window.history.replaceState(null, '', `${base}#/agent/${encodeURIComponent(raw)}`);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(hash: string): void {
  if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = hash;
}

export function profileShareUrl(tokenId: number): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${agentHash(tokenId)}`;
}
