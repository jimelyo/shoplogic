import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, RotateCcw, Trash } from 'lucide-react';
import { db } from '../db/database';
import { confirmDialog, toast } from '../store/store';
import { useFormat } from '../lib/format';
import { generateNotifications } from '../lib/notifications';
import { logAction } from '../lib/audit';
import type { AppNotification, NotificationType } from '../types';
import { NOTIFICATION_ICONS, NOTIFICATION_TYPES } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, IconButton, Pill, ViewToggle, useViewMode } from './shared/UI';
import { Button } from './shared/Forms';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';
import type { BadgeColor } from '../lib/colors';

const TYPE_COLORS: Record<NotificationType, BadgeColor> = { stock_critical: 'red', stock_low: 'amber', repair_overdue: 'orange', invoice_overdue: 'pink', daily_summary: 'blue', system: 'slate' };

export function Notifications() {
  const { t } = useTranslation();
  const f = useFormat();
  const notifs = useLiveQuery(() => db.notifications.orderBy('createdAt').reverse().toArray(), []);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [type, setType] = useState<NotificationType | 'all'>('all');
  const [view, setView] = useViewMode('notifications');
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => (notifs ?? []).filter((n) => (filter === 'all' || (filter === 'unread' ? !n.read : n.read)) && (type === 'all' || n.type === type)), [notifs, filter, type]);
  if (!notifs) return <LoadingPage />;
  const unread = notifs.filter((n) => !n.read).length;

  const title = (n: AppNotification) => t(n.title, { ...(n.params ?? {}), defaultValue: n.title });
  const msg = (n: AppNotification) => t(n.message, { ...(n.params ?? {}), defaultValue: n.message });
  const toggleRead = (n: AppNotification) => db.notifications.update(n.id!, { read: !n.read });
  const remove = (n: AppNotification) => db.notifications.delete(n.id!);
  const markAll = async () => { await db.notifications.toCollection().modify({ read: true }); toast.success(t('notifications.allRead')); };
  const clearAll = async () => {
    if (!(await confirmDialog(t('notifications.confirmClear'), { danger: true, confirmLabel: t('notifications.clearAll') }))) return;
    await db.notifications.clear(); await logAction('delete', 'notifications', t('notifications.clearAll')); toast.success(t('common.deleted'));
  };
  const scan = async () => { setBusy(true); const n = await generateNotifications(); setBusy(false); toast.info(n ? t('notifications.generated', { count: n }) : t('notifications.noNew')); };
  const actions = (n: AppNotification) => (
    <div className="flex justify-end gap-0.5">
      <IconButton title={n.read ? t('notifications.markUnread') : t('notifications.markRead')} tone="success" onClick={() => toggleRead(n)}>{n.read ? <RotateCcw /> : <Check />}</IconButton>
      <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(n)}><Trash /></IconButton>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader icon="🔔" title={t('nav.notifications')} subtitle={t('notifications.subtitle', { count: unread })}
        actions={<>
          <ViewToggle value={view} onChange={setView} />
          <Button variant="secondary" loading={busy} onClick={scan}>🔍 {t('notifications.scan')}</Button>
          <Button variant="secondary" icon={<Check />} disabled={!unread} onClick={markAll}>{t('notifications.markAllRead')}</Button>
          <Button variant="danger" icon={<Trash />} disabled={!notifs.length} onClick={clearAll}>{t('notifications.clearAll')}</Button>
        </>} />
      <div className="flex flex-wrap gap-2">
        {(['all', 'unread', 'read'] as const).map((x) => <Pill key={x} active={filter === x} onClick={() => setFilter(x)} count={x === 'all' ? notifs.length : x === 'unread' ? unread : notifs.length - unread}>{t(`notifications.f_${x}`)}</Pill>)}
        <span className="mx-1 w-px bg-sl-border" />
        <Pill active={type === 'all'} onClick={() => setType('all')}>🏷️ {t('common.all')}</Pill>
        {NOTIFICATION_TYPES.map((x) => <Pill key={x} active={type === x} onClick={() => setType(x)} count={notifs.filter((n) => n.type === x).length}>{NOTIFICATION_ICONS[x]} {t(`notifType.${x}`)}</Pill>)}
      </div>
      {list.length === 0 ? <Card><EmptyState icon="🔕" title={t('notifications.empty')} /></Card> : view === 'cards' ? (
        <div className="space-y-2">
          {list.map((n) => (
            <Card key={n.id} className={`flex items-start gap-3 p-4 animate-slide-up ${n.read ? 'opacity-70' : 'border-s-4 !border-s-primary'}`} onClick={() => !n.read && toggleRead(n)}>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sl-hover text-xl">{NOTIFICATION_ICONS[n.type]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-sl-text">{title(n)}</span><Badge color={TYPE_COLORS[n.type]}>{t(`notifType.${n.type}`)}</Badge>{!n.read && <span className="size-2 rounded-full bg-primary" />}</div>
                <div className="mt-0.5 text-sm text-sl-muted">{msg(n)}</div>
                <div className="mt-1 text-[11px] text-sl-muted">🕐 {f.dateTime(n.createdAt)}</div>
              </div>
              {actions(n)}
            </Card>
          ))}
        </div>
      ) : (
        <DataTable data={list} rowKey={(n) => n.id!} minWidth={760} rowClassName={(n) => (n.read ? 'opacity-70' : 'font-medium')}
          columns={[
            { key: 'createdAt', label: t('common.date'), render: (n) => <span className="whitespace-nowrap text-xs">{f.dateTime(n.createdAt)}</span> },
            { key: 'type', label: t('notifications.type'), render: (n) => <Badge color={TYPE_COLORS[n.type]}>{NOTIFICATION_ICONS[n.type]} {t(`notifType.${n.type}`)}</Badge> },
            { key: 'title', label: t('notifications.title'), render: (n) => <span className="flex items-center gap-1.5">{!n.read && <span className="size-2 rounded-full bg-primary" />}{title(n)}</span>, sortValue: title },
            { key: 'message', label: t('notifications.message'), render: (n) => <span className="text-xs text-sl-muted">{msg(n)}</span>, sortValue: msg },
            { key: '_a', label: t('common.actions'), sortable: false, render: actions },
          ]} />
      )}
    </div>
  );
}