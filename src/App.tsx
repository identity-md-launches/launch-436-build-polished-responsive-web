import { useCallback, useEffect, useState } from 'react';
import { Footer, Header } from './components/Chrome';
import { SearchForm } from './components/SearchForm';
import { MAX_TOKEN_ID, MIN_TOKEN_ID } from './data/config';
import { AgentPage } from './pages/AgentPage';
import { HomePage } from './pages/HomePage';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const onSnapshotAt = useCallback((at: string | null) => setSnapshotAt(at), []);

  useEffect(() => {
    if (route.name === 'home') document.title = 'SIMCARD · animated identity cards for IdentityMD agents';
    if (route.name === 'invalid') document.title = 'SIMCARD · invalid token';
    window.scrollTo({ top: 0 });
  }, [route]);

  return (
    <>
      <a className="skip-link" href="#main" onClick={(event) => { event.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        {route.name === 'home' ? <HomePage /> : null}
        {route.name === 'agent' ? <AgentPage key={route.tokenId} tokenId={route.tokenId} onSnapshotAt={onSnapshotAt} /> : null}
        {route.name === 'invalid' ? (
          <div className="container">
            <section className="state state--error" aria-labelledby="invalid-title">
              <h1 id="invalid-title" className="page-title">Invalid token ID</h1>
              <p role="alert">
                “{route.raw}” is not an identity.md token. Use a whole number between {MIN_TOKEN_ID} and {MAX_TOKEN_ID}.
              </p>
              <SearchForm compact autoFocus />
            </section>
          </div>
        ) : null}
      </main>
      <Footer snapshotAt={snapshotAt} />
    </>
  );
}
