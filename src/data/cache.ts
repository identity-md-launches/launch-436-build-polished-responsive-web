import { CACHE_TTL_MS } from './config';

interface Entry<T> {
  value: T;
  storedAt: number;
}

const memory = new Map<string, Entry<unknown>>();
const PREFIX = 'simcard:cache:';

function readStorage<T>(key: string): Entry<T> | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Entry<T>) : null;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, entry: Entry<T>): void {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage disabled: memory cache still works.
  }
}

/**
 * Short-lived cache for public API responses. `force` bypasses it (the Refresh
 * button). Large payloads stay in memory only.
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  { force = false, ttl = CACHE_TTL_MS, persist = true }: { force?: boolean; ttl?: number; persist?: boolean } = {},
): Promise<T> {
  const now = Date.now();
  if (!force) {
    const hit = (memory.get(key) as Entry<T> | undefined) ?? (persist ? readStorage<T>(key) : null);
    if (hit && now - hit.storedAt < ttl) return hit.value;
  }
  const value = await loader();
  const entry: Entry<T> = { value, storedAt: now };
  memory.set(key, entry);
  if (persist) writeStorage(key, entry);
  return value;
}
