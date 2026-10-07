import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { useStore } from '../../store/store';
import { BADGE_CLASSES, type BadgeColor } from '../../lib/colors';
import { Button } from './Forms';
import { Modal } from './Modal';

export type ViewMode = 'cards' | 'table';

export function useViewMode(key: string, initial: ViewMode = 'cards') {
  const [mode, setModeState] = useState<ViewMode>(() => {
    const v = localStorage.getItem(`sl_view_${key}`);
    return v === 'cards' || v === 'table' ? v : initial;
  });
  const setMode = (m: ViewMode) => { localStorage.setItem(`sl_view_${key}`, m); setModeState(m); };
  return [mode, setMode] as const;
}

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-sl-border bg-sl-card p-0.5 shadow-sm">
      {(['cards', 'table'] as ViewMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${value === m ? 'bg-primary text-white shadow' : 'text-sl-muted hover:text-sl-text'}`}
        >
          <span>{m === 'cards' ? '📇' : '📊'}</span>
          <span className="hidden sm:inline">{t(m === 'cards' ? 'common.cards' : 'common.table')}</span>
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className = '', autoFocus = false }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={`relative min-w-[180px] flex-1 ${className}`}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-sl-muted" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('common.search')}
        className="h-10 w-full rounded-lg border border-sl-border bg-sl-card ps-9 pe-8 text-sm text-sl-text shadow-sm outline-none placeholder:text-sl-muted focus:border-primary focus:ring-2 focus:ring-primary/25"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-sl-muted hover:text-sl-text">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-xl border border-sl-border bg-sl-card shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md hover:border-primary/40' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, color = 'slate', className = '' }: { children: ReactNode; color?: BadgeColor; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BADGE_CLASSES[color]} ${className}`}>
      {children}
    </span>
  );
}

const STAT_TONES: Record<string, string> = {
  indigo: 'from-indigo-500 to-violet-500', green: 'from-emerald-500 to-teal-500', amber: 'from-amber-500 to-orange-500',
  red: 'from-rose-500 to-red-500', blue: 'from-sky-500 to-blue-600', purple: 'from-fuchsia-500 to-purple-600', slate: 'from-slate-500 to-slate-700',
};

export function StatCard({ icon, label, value, sub, tone = 'indigo', onClick, active }: {
  icon: ReactNode; label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: keyof typeof STAT_TONES | string; onClick?: () => void; active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border bg-sl-card p-4 shadow-sm animate-slide-up ${active ? 'border-primary ring-2 ring-primary/30' : 'border-sl-border'} ${onClick ? 'cursor-pointer hover:border-primary/50' : ''}`}
    >
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl text-white shadow-md ${STAT_TONES[tone] ?? STAT_TONES.indigo}`}>{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-sl-muted">{label}</div>
        <div className="truncate text-lg font-bold text-sl-text">{value}</div>
        {sub && <div className="truncate text-[11px] text-sl-muted">{sub}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = '📭', title, hint, action }: { icon?: ReactNode; title?: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="font-semibold text-sl-text">{title ?? t('common.noData')}</div>
      {hint && <div className="max-w-sm text-sm text-sl-muted">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

export function Pill({ active, onClick, children, count }: { active?: boolean; onClick?: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-primary bg-primary text-white shadow shadow-primary/30' : 'border-sl-border bg-sl-card text-sl-text hover:border-primary/50'}`}
    >
      {children}
      {count !== undefined && <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/25' : 'bg-sl-hover text-sl-muted'}`}>{count}</span>}
    </button>
  );
}

export function IconButton({ title, onClick, children, tone = 'default', disabled }: { title: string; onClick: () => void; children: ReactNode; tone?: 'default' | 'danger' | 'primary' | 'success'; disabled?: boolean }) {
  const tones = {
    default: 'text-sl-muted hover:text-sl-text hover:bg-sl-hover',
    danger: 'text-sl-muted hover:text-red-600 hover:bg-red-500/10',
    primary: 'text-sl-muted hover:text-primary hover:bg-primary/10',
    success: 'text-sl-muted hover:text-emerald-600 hover:bg-emerald-500/10',
  };
  return (
    <button type="button" title={title} aria-label={title} disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`rounded-lg p-1.5 disabled:opacity-40 [&_svg]:size-4 ${tones[tone]}`}>
      {children}
    </button>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-sl-text">{children}</h3>
      {right}
    </div>
  );
}

export function InfoRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-sl-border/70 py-2 text-sm last:border-0">
      <span className="text-sl-muted">{label}</span>
      <span className="text-end font-medium text-sl-text">{value}</span>
    </div>
  );
}

export function ConfirmDialog() {
  const { t } = useTranslation();
  const confirm = useStore((s) => s.confirm);
  const close = useStore((s) => s.closeConfirm);
  return (
    <Modal
      open={!!confirm}
      onClose={() => close(false)}
      size="sm"
      title={confirm?.title ?? t('common.confirm')}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>{t('common.cancel')}</Button>
          <Button variant={confirm?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{confirm?.confirmLabel ?? t('common.confirm')}</Button>
        </>
      }
    >
      <p className="whitespace-pre-line text-sm text-sl-text">{confirm?.message}</p>
    </Modal>
  );
}