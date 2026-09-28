import { useId, useState, type FormEvent } from 'react';
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
  const [explorerBase, setExplorerBase] = useState(initial.explorerBase);
  const [saved, setSaved] = useState<string | null>(null);
  const apiId = useId();
  const explorerId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const valid = (v: string) => v.trim() === '' || /^https?:\/\/[^\s]+$/.test(v.trim());
    if (!valid(apiBase) || !valid(explorerBase)) {
      setSaved('Use a full URL starting with https://, or leave the field empty.');
      return;
    }
    setOverrides(apiBase, explorerBase);
    setSaved('Saved. Reload the page or press Refresh on a card to use the new sources.');
  };

  return (
    <details className="settings">
      <summary>Data source settings</summary>
      <form onSubmit={submit}>
        <p>
          Both official origins currently omit CORS headers, so browsers cannot read them directly from a static site. If you
          run this site behind your own CORS-enabled proxy of the same public routes, point the app at it here. Leave empty to
          use the official origins ({OFFICIAL_API_BASE} and {OFFICIAL_EXPLORER_BASE}).
        </p>
        <div className="field">
          <label htmlFor={apiId}>API base URL (optional)</label>
          <input id={apiId} type="url" inputMode="url" autoComplete="url" placeholder="https://your-proxy.example/api" value={apiBase} onChange={(e) => setApiBase(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={explorerId}>Explorer base URL (optional)</label>
          <input id={explorerId} type="url" inputMode="url" autoComplete="url" placeholder="https://your-proxy.example/explorer" value={explorerBase} onChange={(e) => setExplorerBase(e.target.value)} />
        </div>
        <div className="cluster">
          <button type="submit" className="btn btn--sm">
            Save data sources
          </button>
          <span role="status" aria-live="polite">
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
