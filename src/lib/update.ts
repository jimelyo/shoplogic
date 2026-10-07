/**
 * Update system for the PWA: detects new app versions through the service
 * worker lifecycle and, when the option is enabled in Settings, installs and
 * reloads them automatically. Without it, the user just sees a "new version
 * available" chip in Settings and can apply the update in one click.
 *
 * public/sw.js already does `skipWaiting` on install and serves network-first,
 * so once the browser has the new worker the only thing missing is activating
 * it and reloading; this module does exactly that.
 */
import { useStore } from '../store/store';
import i18n from '../i18n';

export type UpdateState = 'idle' | 'checking' | 'updateReady' | 'installing';

export interface UpdateSnapshot {
  /** idle: nothing new · checking: update() in flight · updateReady: waiting worker · installing: reloading now. */
  state: UpdateState;
  /** Seconds between automatic checks (0 = only manual checks). */
  intervalSeconds: number;
  /** Install + reload silently as soon as a new version is ready. */
  autoInstall: boolean;
  /** False when service workers are unavailable (or the SW failed to register). */
  supported: boolean;
}

const LAST_CHECK_KEY = 'sl_update_last_check';
const INTERVAL_KEY = 'sl_update_interval';
const AUTO_KEY = 'sl_update_auto';
const HOUR = 3_600;
const DAY = 24 * HOUR;

function readSavedInterval(): number {
  const raw = Number(localStorage.getItem(INTERVAL_KEY));
  if (!Number.isFinite(raw) || raw < 0) return HOUR; // Hourly by default.
  return Math.min(DAY, Math.round(raw));
}

function readSavedAuto(): boolean {
  return localStorage.getItem(AUTO_KEY) === '1';
}

const listeners = new Set<(s: UpdateSnapshot) => void>();
let snapshot: UpdateSnapshot = { state: 'idle', intervalSeconds: readSavedInterval(), autoInstall: readSavedAuto(), supported: true };
let checking = false;
let registration: ServiceWorkerRegistration | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function emit() {
  for (const l of listeners) l(snapshot);
}

function setState(state: UpdateState) {
  if (snapshot.state === state) return;
  snapshot = { ...snapshot, state };
  emit();
}

function toast(type: 'success' | 'error' | 'info' | 'warning', key: string) {
  useStore.getState().addToast(type, i18n.t(key));
}

/** Subscribes to state changes; fires immediately with the current snapshot. */
export function onUpdate(cb: (s: UpdateSnapshot) => void): () => void {
  listeners.add(cb);
  cb(snapshot);
  return () => { listeners.delete(cb); };
}

/** Preferences setters used by the Settings section; both persist for the device. */
export const updatePrefs = {
  setInterval(seconds: number) {
    const v = Math.max(0, Math.min(DAY, Math.round(seconds)));
    snapshot = { ...snapshot, intervalSeconds: v };
    localStorage.setItem(INTERVAL_KEY, String(v));
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
    if (timer) { clearTimeout(timer); timer = null; }
    if (v > 0) armTimer();
    emit();
  },
  setAuto(autoInstall: boolean) {
    snapshot = { ...snapshot, autoInstall };
    localStorage.setItem(AUTO_KEY, autoInstall ? '1' : '0');
    // Entering auto mode applies a pending update right away.
    if (autoInstall && snapshot.state === 'updateReady') applyUpdate();
    else emit();
  },
};

/** True when service workers are available in this browser. */
export function isUpdateSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/** Asks the server whether a new service worker exists; safe to call concurrently. */
export function requestUpdateCheck(): void {
  if (checking || !registration) return;
  checking = true;
  setState('checking');
  registration.update()
    .catch(() => undefined)
    .finally(() => {
      checking = false;
      // Don't clobber updateReady/installing states set while the check ran.
      if (snapshot.state === 'checking') setState('idle');
    });
}

/**
 * Activates the waiting worker and reloads the page so the new version takes
 * effect immediately. Returns false when there is nothing to apply.
 */
export function applyUpdate(): boolean {
  const waiting = registration?.waiting;
  if (!waiting || !navigator.serviceWorker.controller) return false;
  setState('installing');
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING_SELF' });
  // Fallback: if takeover never happens (SW killed, bug…), reload anyway.
  setTimeout(() => { if (snapshot.state === 'installing') window.location.reload(); }, 4_000);
  return true;
}

function onWaitingFound() {
  setState('updateReady');
  if (snapshot.autoInstall) { applyUpdate(); return; }
  toast('info', 'settings.updPendingToast');
}

function armTimer() {
  const ms = snapshot.intervalSeconds * 1000;
  timer = setTimeout(() => {
    timer = null;
    // Skip while the tab is hidden; the next tick (or the visible event) will check.
    if (typeof document !== 'undefined' && document.hidden) { armTimer(); return; }
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
    if (snapshot.state === 'idle') requestUpdateCheck();
    armTimer();
  }, ms);
}

/** Label keys for the interval picker (keeps the wordy option names in i18n). */
export const INTERVAL_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 0, label: 'settings.updInterval_off' },
  { seconds: HOUR, label: 'settings.updInterval_1h' },
  { seconds: 6 * HOUR, label: 'settings.updInterval_6h' },
  { seconds: DAY, label: 'settings.updInterval_24h' },
];

/** Wires the SW lifecycle listeners and the periodic check; idempotent. */
export async function initUpdateSystem(): Promise<void> {
  if (initialized || !isUpdateSupported()) return;
  initialized = true;
  window.addEventListener('online', () => { if (snapshot.intervalSeconds > 0) requestUpdateCheck(); });
  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      // First visit: main.tsx registers the worker on load; it may not exist yet.
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      reg = await navigator.serviceWorker.getRegistration();
      if (!reg) throw new Error('no service worker registered');
    }
    registration = reg;
    // A worker may already be waiting from a previous session.
    if (reg.waiting && navigator.serviceWorker.controller) onWaitingFound();
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      setState('checking');
      nw.addEventListener('statechange', () => {
        if (nw.state !== 'installed') return;
        if (navigator.serviceWorker.controller) onWaitingFound();
        else setState('idle'); // Very first install; nothing is pending.
      });
    });
  } catch {
    snapshot = { ...snapshot, supported: false };
    emit();
    return;
  }
  if (snapshot.intervalSeconds > 0) armTimer();
}
