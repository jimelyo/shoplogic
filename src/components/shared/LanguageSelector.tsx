import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react';
import { LANGUAGES } from '../../i18n';
import { useClickOutside } from '../../lib/hooks';

export function LanguageSelector({ direction = 'down', compact = false, className = '' }: { direction?: 'up' | 'down'; compact?: boolean; className?: string }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  const cur = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-sl-border bg-sl-card px-2.5 text-sm text-sl-text shadow-sm hover:bg-sl-hover"
        aria-label="language"
      >
        <span className="text-base">{cur.flag}</span>
        {!compact && <span className="hidden font-medium sm:inline">{cur.name}</span>}
        <ChevronDown className="size-3.5 text-sl-muted" />
      </button>
      {open && (
        <div className={`absolute end-0 z-50 w-44 overflow-hidden rounded-xl border border-sl-border bg-sl-card py-1 shadow-xl animate-scale-in ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => { i18n.changeLanguage(l.code); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm hover:bg-sl-hover ${l.code === cur.code ? 'font-semibold text-primary' : 'text-sl-text'}`}
            >
              <span className="text-base">{l.flag}</span>
              <span className="flex-1">{l.name}</span>
              {l.code === cur.code && <Check className="size-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}