import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { CardState, Provenance, Sourced } from '../data/profile';
import { STATE_LABEL } from '../lib/cardModel';
import { formatDateTime } from '../lib/format';

export function StatusBadge({ state, label }: { state: CardState; label?: string }) {
  return (
    <span className={`badge badge--${state}`}>
      <span className="badge__dot" aria-hidden="true" />
      {label ?? STATE_LABEL[state]}
    </span>
  );
}

export const SOURCE_LABEL: Record<Provenance, string> = {
  live: 'Live IMD',
  explorer: 'Explorer',
  onchain: 'Onchain',
  snapshot: 'Snapshot',
  unavailable: 'Unavailable',
};

export function SourceTag({ source, at, note }: { source: Provenance; at?: string | null; note?: string | null }) {
  const title = [SOURCE_LABEL[source], at ? formatDateTime(at) : null, note].filter(Boolean).join(' · ');
  return (
    <span className={`source-tag source-tag--${source}`} title={title}>
      {SOURCE_LABEL[source]}
      {source === 'snapshot' && at ? <span className="visually-hidden"> taken {formatDateTime(at)}</span> : null}
    </span>
  );
}

/**
 * "Live · updated 4 s ago". Plain text on purpose: it changes every second,
 * so it is not a live region. Failures are worded for people, not logs.
 */
export function LiveIndicator({ at, ok, now, compact = false }: { at: string | null; ok: boolean; now: number; compact?: boolean }) {
  const seconds = at ? Math.max(0, Math.round((now - Date.parse(at)) / 1000)) : null;
  const age = seconds === null ? null : seconds < 60 ? `${seconds} s ago` : seconds < 3600 ? `${Math.round(seconds / 60)} min ago` : `${Math.round(seconds / 3600)} h ago`;
  const state = !at ? 'waiting' : ok ? 'ok' : 'retrying';
  const label = state === 'waiting' ? 'Live · waiting for the first update'
    : state === 'ok' ? `Live · updated ${age}` : `Live · retrying · last update ${age}`;
  return (
    <span className={`live-indicator live-indicator--${state}`} title={at ? `Last live read ${formatDateTime(at)}${ok ? '' : '. The newest attempt did not complete; earlier values are kept.'}` : undefined}>
      <span className="live-indicator__dot" aria-hidden="true" />
      {compact && state === 'ok' ? `Live · ${age}` : label}
    </span>
  );
}

export function SourcedHeading({ title, sourced }: { title: string; sourced: Sourced<unknown> }) {
  return (
    <div className="profile-section__head">
      <h3>{title}</h3>
      <SourceTag source={sourced.source} at={sourced.at} note={sourced.note} />
    </div>
  );
}

export function Unavailable({ note }: { note?: string | null }) {
  return <span className="unavailable unavailable--badge" title={note ?? undefined}>Unavailable{note ? <span className="visually-hidden">: {note}</span> : null}</span>;
}

export function QrCode({ value, size = 128, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0b0fff', light: '#ffffffff' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);
  if (!src) return <span className={className} aria-hidden="true" />;
  return <img className={className} src={src} width={size} height={size} alt={`QR code linking to ${value}`} />;
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      aria-label={copied ? `${label} copied` : label}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function ExternalIcon() {
  return (
    <svg className="btn__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 3H3.5A.5.5 0 0 0 3 3.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V10" />
      <path d="M9 3h4v4M13 3 7 9" />
    </svg>
  );
}
