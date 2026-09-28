export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatInt(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

export function percent(numerator: number, denominator: number, digits = 1): string {
  if (!denominator) return '—';
  return `${((numerator / denominator) * 100).toFixed(digits)}%`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Unavailable';
  const d = new Date(iso.replace(' ', 'T').replace(/\+00$/, 'Z'));
  if (Number.isNaN(d.getTime())) return 'Unavailable';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'Unavailable';
  const t = new Date(iso.replace(' ', 'T').replace(/\+00$/, 'Z')).getTime();
  if (Number.isNaN(t)) return 'Unavailable';
  const diff = Math.max(0, now - t);
  const s = Math.round(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d} days ago`;
  const mo = Math.round(d / 30);
  return `${mo} months ago`;
}

export function formatDays(days: number | null | undefined): string {
  if (typeof days !== 'number') return 'Unavailable';
  if (days < 1) return 'under a day';
  return days === 1 ? '1 day' : `${days} days`;
}

/** Format a raw token amount with decimals, compact for large values. */
export function formatTokenAmount(amount: string, decimals: number): string {
  let big: bigint;
  try {
    big = BigInt(amount);
  } catch {
    return amount;
  }
  const base = 10n ** BigInt(decimals);
  const whole = big / base;
  const frac = big % base;
  const wholeNum = Number(whole);
  if (wholeNum >= 1_000_000) return `${(wholeNum / 1_000_000).toFixed(2)}M`;
  if (wholeNum >= 10_000) return `${(wholeNum / 1_000).toFixed(1)}K`;
  if (wholeNum >= 1) return `${wholeNum.toLocaleString('en-US')}${frac > 0n ? '.' + frac.toString().padStart(decimals, '0').slice(0, 2) : ''}`;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '');
  return fracStr ? `0.${fracStr}` : '0';
}

export function titleCase(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
