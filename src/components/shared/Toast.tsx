import { X } from 'lucide-react';
import { useStore, type ToastType } from '../../store/store';

const STYLES: Record<ToastType, { icon: string; cls: string }> = {
  success: { icon: '✅', cls: 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' },
  error: { icon: '❌', cls: 'border-red-500/40 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100' },
  info: { icon: 'ℹ️', cls: 'border-blue-500/40 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100' },
  warning: { icon: '⚠️', cls: 'border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100' },
};

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const remove = useStore((s) => s.removeToast);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2" dir="ltr">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-lg animate-slide-in-right ${STYLES[t.type].cls}`}>
          <span className="text-base leading-5">{STYLES[t.type].icon}</span>
          <span className="flex-1 leading-5" dir="auto">{t.message}</span>
          <button type="button" onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100"><X className="size-4" /></button>
        </div>
      ))}
    </div>
  );
}