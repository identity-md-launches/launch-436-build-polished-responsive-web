import { useId, useRef, useState, type FormEvent } from 'react';
import { getOverrides, OFFICIAL_API_BASE, OFFICIAL_EXPLORER_BASE, setOverrides } from '../data/config';

export function Header() {
  return (
    <header className="site-header">
      <div className="container">
        <a className="wordmark" href="#/" aria-label="SIMCARD home">
          <span className="wordmark__chip" aria-hidden="true" />
          SIMCARD <span className="wordmark__sub">for IdentityMD agents</span>
        </a>
        <nav className="site-nav" aria-label="External sites">
          <a href="https://explorer.imd.fun" target="_blank" rel="noopener noreferrer">
            Explorer
          </a>
          <a href="https://imd.fun" target="_blank" rel="noopener noreferrer">
            imd.fun
          </a>
        </nav>
      </div>
    </header>
  );
}

function DataSourceSettings() {
  const initial = getOverrides();
  const [apiBase, setApiBase] = useState(initial.apiBase);
  const [saved, setSaved] = useState<string | null>(null);
  const apiId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const valid = (v: string) => {
      if (!v.trim()) return true;
      try { const url = new URL(v.trim()); return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash; }
      catch { return false; }
    };
    if (!valid(apiBase)) {
      setInvalid(true);
      inputRef.current?.focus();
      setSaved('Use an HTTPS URL without credentials, query or fragment, or leave empty.');
      return;
    }
    setInvalid(false);
    setOverrides(apiBase);
    setSaved('Saved. Reload the page or press Refresh on a card to use the new sources.');
  };

  return (
    <details className="settings">
      <summary>Data source settings</summary>
      <form onSubmit={submit}>
        <p>
          Optional: use a trusted first-party proxy when browser requests to the official sources are blocked.
          Leave empty to retry {OFFICIAL_API_BASE} and {OFFICIAL_EXPLORER_BASE} directly.
        </p>
        <div className="field">
          <label htmlFor={apiId}>Trusted first-party base URL (optional)</label>
          <input ref={inputRef} aria-invalid={invalid || undefined} aria-describedby={`${apiId}-result`} id={apiId} type="url" inputMode="url" autoComplete="url" placeholder="https://your-proxy.example/api" value={apiBase} onChange={(e) => setApiBase(e.target.value)} />
        </div>
        <div className="cluster">
          <button type="submit" className="btn btn--sm">
            Save data source
          </button>
          <span id={`${apiId}-result`} role="status" aria-live="polite">
            {saved}
          </span>
        </div>
      </form>
    </details>
  );
}

export function Footer({ snapshotAt }: { snapshotAt: string | null }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          SIMCARD is a read-only community view of public IdentityMD data. It never asks for a wallet connection, seed
          phrase, private key, approval or signature, and it deploys nothing.
        </p>
        <p>
          Sources: api.imd.fun, explorer.imd.fun, Ethereum mainnet through public JSON-RPC, and a build-time snapshot of the
          same public API{snapshotAt ? ` (taken ${new Date(snapshotAt).toUTCString()})` : ''}. Values that cannot be verified
          from those sources are shown as “Unavailable”.
        </p>
        <DataSourceSettings />
      </div>
    </footer>
  );
}

export function Toast({ message, kind, onDismiss }: { message: string | null; kind: 'status' | 'alert'; onDismiss: () => void }) {
  return (
    <div className="toast-region">
      <div role={kind === 'alert' ? 'alert' : 'status'} aria-live={kind === 'alert' ? 'assertive' : 'polite'}>
        {message ? (
          <div className="toast">
            <span>{message}</span>
            <button type="button" className="btn btn--sm btn--ghost" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
