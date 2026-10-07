import type { ReactNode } from 'react';

export function PageHeader({ icon, title, subtitle, actions }: { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-2xl">{icon}</div>}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-sl-text sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-sl-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}