import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initI18n } from './i18n';
import App from './App';
import { dumpOldOrigin, restoreOldOriginData } from './lib/origin-migration';

async function boot() {
  // The active locale is a separate chunk; load it before the first render so
  // no screen flashes an empty translation tree.
  await initI18n();
  if (location.hash.startsWith('#__sl-migrate-origin')) {
    // Ventana oculta de migración sobre el origen viejo (file://): volcado único.
    await dumpOldOrigin();
  } else if (location.protocol === 'app:') {
    // Primer arranque en el origen nuevo: importar el volcado de file://.
    await restoreOldOriginData();
  }
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
