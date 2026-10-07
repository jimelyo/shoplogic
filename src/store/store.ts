import { create } from 'zustand';
import type { Accent, NavSection, Product, Role, ThemeMode } from '../types';
import { ACCENTS, ALL_MODULES } from '../types';

export interface SessionUser { id: number; name: string; email: string; role: Role; permissions: NavSection[] }
export interface CartItem { product: Product; quantity: number }
export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastMsg { id: number; type: ToastType; message: string }
export interface ConfirmOptions { title?: string; danger?: boolean; confirmLabel?: string }
interface ConfirmState extends ConfirmOptions { message: string; resolve: (v: boolean) => void }

interface AppState {
  mode: ThemeMode; accent: Accent;
  setMode: (m: ThemeMode) => void; setAccent: (a: Accent) => void;
  currentUser: SessionUser | null;
  setCurrentUser: (u: SessionUser | null) => void;
  logout: () => void;
  activeModule: NavSection;
  setActiveModule: (m: NavSection) => void;
  /** True while the screen is locked behind the current user's password. */
  locked: boolean;
  setLocked: (v: boolean) => void;
  /** Product whose stock ledger is focused when the stock module opens. */
  stockFocusProductId: number | null;
  setStockFocusProductId: (id: number | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  cartItems: CartItem[];
  addToCart: (p: Product) => boolean;
  updateQuantity: (productId: number, delta: number) => boolean;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  toasts: ToastMsg[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: number) => void;
  refreshKey: number;
  refresh: () => void;
  confirm: ConfirmState | null;
  askConfirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
  closeConfirm: (v: boolean) => void;
}

const loadTheme = (): { mode: ThemeMode; accent: Accent } => ({
  mode: (localStorage.getItem('sl_mode') as ThemeMode) === 'dark' ? 'dark' : 'light',
  accent: (ACCENTS.includes(localStorage.getItem('sl_accent') as Accent) ? localStorage.getItem('sl_accent') : 'default') as Accent,
});

export function applyTheme(mode: ThemeMode, accent: Accent) {
  const el = document.documentElement;
  el.classList.remove('light', 'dark', ...ACCENTS.map((a) => `accent-${a}`));
  el.classList.add(mode, `accent-${accent}`);
  el.style.colorScheme = mode;
}

const loadSession = (): SessionUser | null => {
  try { return JSON.parse(localStorage.getItem('sl_session') || 'null'); } catch { return null; }
};

let toastId = 0;

export const useStore = create<AppState>((set, get) => ({
  ...loadTheme(),
  setMode: (mode) => { localStorage.setItem('sl_mode', mode); applyTheme(mode, get().accent); set({ mode }); },
  setAccent: (accent) => { localStorage.setItem('sl_accent', accent); applyTheme(get().mode, accent); set({ accent }); },

  currentUser: loadSession(),
  setCurrentUser: (u) => {
    if (u) localStorage.setItem('sl_session', JSON.stringify(u)); else localStorage.removeItem('sl_session');
    set({ currentUser: u });
  },
  logout: () => { localStorage.removeItem('sl_session'); set({ currentUser: null, cartItems: [], locked: false }); },

  activeModule: ((): NavSection => {
    // The URL hash wins so a reload / shared link opens the same module.
    const fromHash = window.location.hash.replace(/^#\/?/, '');
    if (fromHash && (ALL_MODULES as string[]).includes(fromHash)) return fromHash as NavSection;
    return (localStorage.getItem('sl_module') as NavSection) || 'dashboard';
  })(),
  setActiveModule: (m) => {
    localStorage.setItem('sl_module', m);
    // Keep the address bar in sync (skip duplicates: assigning the hash would
    // push a history entry and re-fire `hashchange`).
    const hash = `#/${m}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    set({ activeModule: m, sidebarOpen: false });
  },
  locked: false,
  setLocked: (locked) => set({ locked }),

  stockFocusProductId: null,
  setStockFocusProductId: (stockFocusProductId) => set({ stockFocusProductId }),
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  cartItems: [],
  addToCart: (p) => {
    const items = get().cartItems;
    const ex = items.find((i) => i.product.id === p.id);
    const qty = ex ? ex.quantity : 0;
    if (qty + 1 > p.stock) return false;
    set({ cartItems: ex ? items.map((i) => (i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i)) : [...items, { product: p, quantity: 1 }] });
    return true;
  },
  updateQuantity: (productId, delta) => {
    const items = get().cartItems;
    const it = items.find((i) => i.product.id === productId);
    if (!it) return false;
    const q = it.quantity + delta;
    if (q > it.product.stock) return false;
    set({ cartItems: q <= 0 ? items.filter((i) => i.product.id !== productId) : items.map((i) => (i.product.id === productId ? { ...i, quantity: q } : i)) });
    return true;
  },
  removeFromCart: (productId) => set({ cartItems: get().cartItems.filter((i) => i.product.id !== productId) }),
  clearCart: () => set({ cartItems: [] }),

  toasts: [],
  addToast: (type, message) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }].slice(-5) }));
    setTimeout(() => get().removeToast(id), 3500);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  refreshKey: 0,
  refresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),

  confirm: null,
  askConfirm: (message, opts) => new Promise<boolean>((resolve) => set({ confirm: { message, ...opts, resolve } })),
  closeConfirm: (v) => { get().confirm?.resolve(v); set({ confirm: null }); },
}));

const initial = loadTheme();
applyTheme(initial.mode, initial.accent);

export const toast = {
  success: (m: string) => useStore.getState().addToast('success', m),
  error: (m: string) => useStore.getState().addToast('error', m),
  info: (m: string) => useStore.getState().addToast('info', m),
  warning: (m: string) => useStore.getState().addToast('warning', m),
};
export const confirmDialog = (message: string, opts?: ConfirmOptions) => useStore.getState().askConfirm(message, opts);