export type AutomationGroup = 'whatsapp' | 'email' | 'inventory' | 'sales' | 'clients' | 'billing' | 'system';
export interface AutomationDef { id: string; group: AutomationGroup; icon: string }

export const AUTOMATION_GROUP_ICONS: Record<AutomationGroup, string> = {
  whatsapp: '📱', email: '📧', inventory: '📦', sales: '💰', clients: '👥', billing: '📄', system: '⚙️',
};

export const AUTOMATIONS: AutomationDef[] = [
  { id: 'wa_repair_ready', group: 'whatsapp', icon: '✅' },
  { id: 'wa_repair_received', group: 'whatsapp', icon: '📥' },
  { id: 'wa_repair_delayed', group: 'whatsapp', icon: '⏰' },
  { id: 'wa_purchase_receipt', group: 'whatsapp', icon: '🧾' },
  { id: 'em_repair_completed', group: 'email', icon: '🔧' },
  { id: 'em_stock_critical', group: 'email', icon: '🚨' },
  { id: 'em_daily_summary', group: 'email', icon: '📊' },
  { id: 'inv_stock_alert', group: 'inventory', icon: '⚠️' },
  { id: 'inv_auto_order', group: 'inventory', icon: '🛒' },
  { id: 'inv_stock_notification', group: 'inventory', icon: '🔔' },
  { id: 'inv_price_alert', group: 'inventory', icon: '🏷️' },
  { id: 'sal_whatsapp_receipt', group: 'sales', icon: '💬' },
  { id: 'sal_daily_summary', group: 'sales', icon: '📈' },
  { id: 'sal_loyalty_points', group: 'sales', icon: '⭐' },
  { id: 'cli_birthday_discount', group: 'clients', icon: '🎂' },
  { id: 'bil_pending_reminder', group: 'billing', icon: '⏳' },
  { id: 'bil_overdue_alert', group: 'billing', icon: '⚠️' },
  { id: 'bil_tax_report', group: 'billing', icon: '🧮' },
  { id: 'sys_daily_backup', group: 'system', icon: '💾' },
  { id: 'sys_weekly_report', group: 'system', icon: '📅' },
  { id: 'sys_suspicious_alert', group: 'system', icon: '🛡️' },
];

/**
 * Automations still on the roadmap: listed with a 🚧 badge and a disabled toggle
 * so the user knows exactly what works today (the implemented ones are the six
 * real flows: wa_repair_ready, em_repair_completed, inv_stock_alert,
 * inv_auto_order, sal_whatsapp_receipt, bil_overdue_alert + sys_daily_backup).
 */
export const PLANNED_AUTOMATIONS = new Set([
  'wa_repair_received', 'wa_repair_delayed', 'wa_purchase_receipt',
  'em_stock_critical', 'em_daily_summary',
  'inv_stock_notification', 'inv_price_alert',
  'cli_birthday_discount', 'bil_pending_reminder', 'bil_tax_report',
  'sys_weekly_report', 'sys_suspicious_alert',
]);

export const DEFAULT_AUTOMATIONS: Record<string, boolean> = Object.fromEntries(
  AUTOMATIONS.map((a) => [a.id, ['inv_stock_alert', 'sal_daily_summary', 'sal_loyalty_points', 'bil_overdue_alert', 'wa_repair_ready', 'sys_daily_backup', 'sys_suspicious_alert'].includes(a.id)]),
);