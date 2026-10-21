import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initI18n } from './i18n';
import App from './App';

async function boot() {
  // The active locale is a separate chunk; load it before the first render so
  // no screen flashes an empty translation tree.
  await initI18n();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
