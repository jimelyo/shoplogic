import { useEffect, type RefObject } from 'react';
import { useStore } from '../store/store';
import { useSettings } from './format';

const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const CHECK_MS = 10_000;

/**
 * Locks the screen after `settings.lockAfterMinutes` of inactivity (0 disables it).
 * Activity only postpones the lock; unlocking always requires the user's password.
 */
export function useIdleLock(enabled: boolean) {
  const setLocked = useStore((s) => s.setLocked);
  const { lockAfterMinutes } = useSettings();

  useEffect(() => {
    const minutes = lockAfterMinutes || 0;
    // Disabling the lock only stops future locks: unlocking always goes through
    // the password (or logout), so this effect never has to write state up front.
    if (!enabled || minutes <= 0) return;

    let last = Date.now();
    const mark = () => { last = Date.now(); };
    const tick = () => {
      if (!useStore.getState().locked && Date.now() - last >= minutes * 60_000) setLocked(true);
    };
    ACTIVITY.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const iv = window.setInterval(tick, CHECK_MS);
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, mark));
      window.clearInterval(iv);
    };
  }, [enabled, lockAfterMinutes, setLocked]);
}

export function useClickOutside(ref: RefObject<HTMLElement | null>, handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const fn = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    };
    document.addEventListener('mousedown', fn);
    document.addEventListener('touchstart', fn);
    return () => {
      document.removeEventListener('mousedown', fn);
      document.removeEventListener('touchstart', fn);
    };
  }, [ref, handler, active]);
}

export const matches = (q: string, ...fields: (string | number | undefined | null)[]) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return fields.some((f) => f !== undefined && f !== null && String(f).toLowerCase().includes(s));
};