import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

export interface ModalProps {
  open: boolean; onClose: () => void; title?: ReactNode; subtitle?: ReactNode; size?: keyof typeof SIZES; children: ReactNode; footer?: ReactNode;
}

export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`flex max-h-[96dvh] w-full ${SIZES[size]} flex-col rounded-t-2xl border border-sl-border bg-sl-card shadow-2xl animate-scale-in sm:max-h-[92dvh] sm:rounded-2xl`}>
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 border-b border-sl-border px-5 py-4">
            <div className="min-w-0">
              {title && <h3 className="truncate text-base font-bold text-sl-text">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-xs text-sl-muted">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-sl-muted hover:bg-sl-hover hover:text-sl-text" aria-label="close">
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-sl-border px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}