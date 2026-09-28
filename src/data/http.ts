import { REQUEST_TIMEOUT_MS } from './config';

export type HttpFailureKind = 'not-found' | 'bad-request' | 'server' | 'unreachable' | 'timeout' | 'parse';

export class HttpError extends Error {
  kind: HttpFailureKind;
  status: number | undefined;
  url: string;
  constructor(kind: HttpFailureKind, url: string, message: string, status?: number) {
    super(message);
    this.name = 'HttpError';
    this.kind = kind;
    this.url = url;
    this.status = status;
  }
}

/**
 * GET JSON with a timeout. A `TypeError` from fetch means the browser refused
 * or could not complete the request: offline, DNS, or a missing
 * Access-Control-Allow-Origin header. Both official IMD origins currently omit
 * that header, so callers treat `unreachable` as "fall back", not "fail".
 */
export async function getJson<T>(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
  } catch (error) {
    window.clearTimeout(timer);
    if ((error as Error).name === 'AbortError') throw new HttpError('timeout', url, 'Request timed out');
    throw new HttpError('unreachable', url, 'Blocked or offline');
  }
  window.clearTimeout(timer);
  if (response.status === 404) throw new HttpError('not-found', url, 'Not found', 404);
  if (response.status === 400) throw new HttpError('bad-request', url, 'Bad request', 400);
  if (!response.ok) throw new HttpError('server', url, `HTTP ${response.status}`, response.status);
  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpError('parse', url, 'Response was not JSON');
  }
}

export async function postJson<T>(url: string, body: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    window.clearTimeout(timer);
    if ((error as Error).name === 'AbortError') throw new HttpError('timeout', url, 'Request timed out');
    throw new HttpError('unreachable', url, 'Blocked or offline');
  }
  window.clearTimeout(timer);
  if (!response.ok) throw new HttpError('server', url, `HTTP ${response.status}`, response.status);
  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpError('parse', url, 'Response was not JSON');
  }
}

export function isHttpError(error: unknown, kind?: HttpFailureKind): error is HttpError {
  return error instanceof HttpError && (kind === undefined || error.kind === kind);
}
