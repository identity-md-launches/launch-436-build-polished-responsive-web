import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { normalizeEntryUrl } from './router';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/simcard.css';
import './styles/profile.css';

normalizeEntryUrl();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
