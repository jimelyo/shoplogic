import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

/**
 * Injects the list of built asset URLs into public/sw.js so the service worker
 * precaches the whole shell (hashed bundles included): a first visit that goes
 * offline right away still boots instead of showing a blank page.
 */
function precacheWorker(): Plugin {
  return {
    name: 'precache-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const assets = ['/', '/manifest.json', '/icon.svg']
      for (const file of Object.keys(bundle)) assets.push('/' + file)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `// ShopLogic Pro service worker — network-first so updates are always visible, cache fallback for offline use.
const CACHE = 'shoplogic-v2';
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => undefined)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('/')))
  );
});
`,
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), precacheWorker()],
    // Relative base: the static build must work from file:// inside Electron
    // (absolute /assets/... URLs break there). Harmless for the web deploy.
    base: './',
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.npm_package_version ?? ''),
    },
    build: { chunkSizeWarningLimit: 3000 },
  };
})