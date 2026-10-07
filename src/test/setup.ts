// Provides a real (in-memory) IndexedDB so Dexie behaves exactly like in the browser.
import 'fake-indexeddb/auto';

/**
 * jsdom ships its own localStorage, but some Node runtimes expose a partial
 * `localStorage` global that shadows it (and lacks the Storage API). The store
 * module reads it at import time, so make sure the API is fully functional.
 */
const storageWorks = (() => {
  try {
    return typeof globalThis.localStorage?.getItem === 'function';
  } catch {
    return false;
  }
})();

if (!storageWorks) {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
      clear: () => { map.clear(); },
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      get length() { return map.size; },
    },
  });
}
