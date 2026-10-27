import { useTranslation } from 'react-i18next';
import { ACCENTS } from '../../types';
import { useStore } from '../../store/store';
import { logAction } from '../../lib/audit';
import type { Accent } from '../../types';
import { ACCENT_META } from '../Layout';
import { Card, SectionTitle } from '../shared/UI';
import { UpdateCard } from './UpdateCard';

const DARK_BG: Record<Accent, string> = { default: '#0f172a', green: '#064e3b', red: '#7f1d1d', blue: '#1e3a5f', purple: '#3b0764', orange: '#7c2d12' };
const LIGHT_CARD: Record<Accent, string> = { default: '#ffffff', green: '#f0fdf4', red: '#fff5f5', blue: '#f0f7ff', purple: '#faf5ff', orange: '#fffaf5' };

export function AppearanceSection() {
  const { t } = useTranslation();
  const { mode, accent, setMode, setAccent } = useStore();
  return (
    <Card className="p-5">
      <SectionTitle>🎨 {t('settings.s_appearance')}</SectionTitle>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sl-muted">{t('theme.mode')}</div>
      <div className="mb-5 grid max-w-md grid-cols-2 gap-3">
        {(['light', 'dark'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); logAction('update', 'settings', `theme: ${m}`); }}
            className={`overflow-hidden rounded-xl border-2 text-start ${mode === m ? 'border-primary' : 'border-sl-border'}`}>
            <div className="flex h-16" style={{ background: m === 'dark' ? '#0f172a' : '#f1f5f9' }}>
              <div className="w-1/4" style={{ background: m === 'dark' ? '#0b1222' : '#fff' }} />
              <div className="m-2 flex-1 rounded" style={{ background: m === 'dark' ? '#1e293b' : '#fff' }} />
            </div>
            <div className="bg-sl-card px-3 py-2 text-sm font-semibold text-sl-text">{m === 'light' ? '☀️' : '🌙'} {t(`theme.${m}`)}</div>
          </button>
        ))}
      </div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sl-muted">{t('theme.accent')}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {ACCENTS.map((a) => (
          <button key={a} type="button" onClick={() => { setAccent(a); logAction('update', 'settings', `accent: ${a}`); }}
            className={`overflow-hidden rounded-xl border-2 ${accent === a ? 'border-primary ring-2 ring-primary/30' : 'border-sl-border'}`}>
            <div className="flex h-14" style={{ background: mode === 'dark' ? DARK_BG[a] : LIGHT_CARD[a] }}>
              <div className="m-2 flex-1 rounded-md" style={{ background: ACCENT_META[a].hex, opacity: 0.9 }} />
            </div>
            <div className="bg-sl-card px-2 py-2 text-xs font-semibold text-sl-text">{ACCENT_META[a].icon} {t(`theme.accent_${a}`)}</div>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-sl-muted">💡 {t('settings.appearanceHint')}</p>
      <div className="mt-6 border-t border-sl-border pt-5">
        <UpdateCard />
      </div>
    </Card>
  );
}
