import { useTranslation } from 'react-i18next';
import { db, getSettings } from '../db/database';
import { DEFAULT_CHANNELS } from '../data/channels';
import { channelReady, channelStatusOf } from '../lib/channels';
import type { ChannelId, ChannelStatus } from '../types';
import { toast, useStore } from '../store/store';
import { useFormat } from '../lib/format';
import { logAction } from '../lib/audit';
import { AUTOMATIONS, AUTOMATION_GROUP_ICONS, DEFAULT_AUTOMATIONS, PLANNED_AUTOMATIONS, type AutomationGroup } from '../data/automations';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, StatCard } from './shared/UI';
import { Button, Toggle } from './shared/Forms';

const GROUPS = Object.keys(AUTOMATION_GROUP_ICONS) as AutomationGroup[];
/** Groups whose automations depend on a configured delivery channel. */
const GROUP_CHANNEL: Partial<Record<AutomationGroup, ChannelId>> = { whatsapp: 'whatsapp', email: 'email' };
const CH_STATUS_ICONS: Record<ChannelStatus, string> = { off: '⏸️', incomplete: '⚠️', ready: '✅' };
const CH_STATUS_COLORS = { off: 'slate', incomplete: 'amber', ready: 'green' } as const;

export function Automations() {
  const { t } = useTranslation();
  const f = useFormat();
  const setActive = useStore((s) => s.setActiveModule);
  const channels = f.settings.channels ?? DEFAULT_CHANNELS;
  const state = { ...DEFAULT_AUTOMATIONS, ...(f.settings.automations ?? {}) };
  const goToChannels = () => { localStorage.setItem('sl_settings_section', 'channels'); setActive('settings'); };
  // Planned automations never count as active: they do not run yet.
  const active = AUTOMATIONS.filter((a) => !PLANNED_AUTOMATIONS.has(a.id) && state[a.id]).length;
  // …nor as paused: they cannot be switched on at all.
  const paused = AUTOMATIONS.filter((a) => !PLANNED_AUTOMATIONS.has(a.id) && !state[a.id]).length;

  const persist = async (next: Record<string, boolean>) => { const s = await getSettings(); await db.settings.update(s.id!, { automations: next }); };
  const toggle = async (id: string, v: boolean) => {
    await persist({ ...state, [id]: v });
    await logAction(v ? 'toggle_on' : 'toggle_off', 'automations', t(`automations.${id}`));
    toast.success(`${v ? '✅' : '⏸️'} ${t(`automations.${id}`)}`);
    const def = AUTOMATIONS.find((a) => a.id === id);
    const channel = def ? GROUP_CHANNEL[def.group] : undefined;
    if (v && channel && !channelReady(channels, channel)) toast.warning(t('channels.automationNeedsChannel', { channel: t(`channels.${channel}`) }));
  };
  const setGroup = async (g: AutomationGroup, v: boolean) => {
    const next = { ...state };
    AUTOMATIONS.filter((a) => a.group === g).forEach((a) => { next[a.id] = v; });
    await persist(next);
    await logAction(v ? 'toggle_on' : 'toggle_off', 'automations', t(`automationGroup.${g}`));
  };

  return (
    <div className="space-y-4">
      <PageHeader icon="🤖" title={t('nav.automations')} subtitle={t('automations.subtitle')}
        actions={<Button variant="secondary" onClick={goToChannels}>📡 {t('channels.configure')}</Button>} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon="🤖" tone="indigo" label={t('automations.total')} value={AUTOMATIONS.length} />
        <StatCard icon="✅" tone="green" label={t('automations.active')} value={active} />
        <StatCard icon="⏸️" tone="slate" label={t('automations.paused')} value={paused} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => {
          const items = AUTOMATIONS.filter((a) => a.group === g);
          const on = items.filter((a) => state[a.id]).length;
          const channel = GROUP_CHANNEL[g];
          const status = channel ? channelStatusOf(channels, channel) : null;
          return (
            <Card key={g} className="p-4 animate-slide-up">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-xl">{AUTOMATION_GROUP_ICONS[g]}</span>
                  <div><div className="font-bold text-sl-text">{t(`automationGroup.${g}`)}</div><div className="text-[11px] text-sl-muted">{on}/{items.length} {t('automations.activeLower')}</div></div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setGroup(g, true)}>{t('automations.allOn')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setGroup(g, false)}>{t('automations.allOff')}</Button>
                </div>
              </div>
              {channel && status && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-sl-border bg-sl-hover/60 px-3 py-2">
                  <Badge color={CH_STATUS_COLORS[status]}>{CH_STATUS_ICONS[status]} {t(`channels.status_${status}`)}</Badge>
                  <span className="text-xs text-sl-muted">{t('channels.channelForAutomations')}</span>
                  <button type="button" onClick={goToChannels} className="ms-auto text-xs font-semibold text-primary hover:underline">
                    📡 {t('channels.configure')}
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {items.map((a) => {
                  const planned = PLANNED_AUTOMATIONS.has(a.id);
                  const on = !planned && !!state[a.id];
                  return (
                    <div key={a.id} className={`flex items-center gap-3 rounded-lg border p-3 ${on ? 'border-primary/40 bg-primary/5' : 'border-sl-border'} ${planned ? 'opacity-70' : ''}`}>
                      <span className="text-xl">{a.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-sl-text">{t(`automations.${a.id}`)}</div>
                          {planned && <Badge color="amber">🚧 {t('automations.soon')}</Badge>}
                        </div>
                        <div className="text-xs text-sl-muted">{t(`automations.${a.id}_desc`)}</div>
                      </div>
                      <Toggle checked={on} disabled={planned} onChange={(v) => toggle(a.id, v)} />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-center text-xs text-sl-muted">ℹ️ {t('automations.note')}</p>
    </div>
  );
}