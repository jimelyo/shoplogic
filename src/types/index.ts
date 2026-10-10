export type NavSection =
  | 'dashboard' | 'pos' | 'cash' | 'inventory' | 'stock' | 'repairs' | 'quotes' | 'clients' | 'providers' | 'purchases' | 'expenses'
  | 'billing' | 'reports' | 'users' | 'notifications' | 'automations' | 'settings';
/** State of a quote: open → accepted → converted to a sale or a repair, or rejected/expired. */
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
export type Role = 'admin' | 'manager' | 'technician' | 'cashier';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type RepairStatus = 'received' | 'diagnosis' | 'in_progress' | 'waiting_parts' | 'completed' | 'delivered' | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
export type ExpenseCategory = 'rent' | 'utilities' | 'material' | 'payroll' | 'marketing' | 'maintenance' | 'other';
export type NotificationType = 'stock_critical' | 'stock_low' | 'repair_overdue' | 'invoice_overdue' | 'daily_summary' | 'system';
export type InvoiceNumbering = 'sequential' | 'date' | 'year' | 'custom';
export type ThemeMode = 'light' | 'dark';
export type Accent = 'default' | 'green' | 'red' | 'blue' | 'purple' | 'orange';
export type PrinterConnection = 'usb' | 'network' | 'bluetooth' | 'system';

export interface Product {
  id?: number; name: string; category: string; barcode: string; imei?: string;
  cost: number; price: number; stock: number; minStock: number; description?: string; createdAt: string;
}
export interface SaleItem { productId: number; name: string; category: string; quantity: number; price: number; cost: number }
/** One line of a split payment: method + amount covered by that method. */
export interface SalePaymentLine { method: PaymentMethod; amount: number }
export interface Sale {
  id?: number; ticketNumber: string; date: string; items: SaleItem[]; subtotal: number; tax: number; total: number;
  /** Cart-level discount applied at checkout, VAT included; `discountPercent` only when the % mode was used. */
  discount?: number; discountPercent?: number;
  /** Primary method (also kept in `splitPayments[0]` when the customer paid several ways). */
  paymentMethod: PaymentMethod;
  /** When the customer paid with more than one method; absent for the common single-method sale. */
  splitPayments?: SalePaymentLine[];
  customerId?: number; customerName?: string; userName?: string;
}
export interface Repair {
  id?: number; ticketNumber: string; dateIn: string; dateOut?: string; customerName: string; customerPhone: string;
  customerEmail?: string; customerId?: number; device: string; imei: string; problem: string; diagnosis?: string; notes?: string;
  status: RepairStatus; estimatedCost: number; finalCost?: number; createdAt: string;
}
export type StockMoveType = 'initial' | 'sale' | 'purchase' | 'adjustment' | 'create' | 'delete' | 'repair' | 'return';
/** A signed ledger entry for every change of a product's stock level. */
export interface StockMove {
  id?: number; productId: number; productName: string; type: StockMoveType; qty: number;
  stockBefore: number; stockAfter: number; reference?: string; note?: string; userName?: string; timestamp: string;
}

export interface CashAdjustment {
  type: 'deposit' | 'withdraw'; amount: number; note?: string; at: string; userName?: string;
}
/** One till shift: from opening the drawer to counting it at the end. */
export interface CashSession {
  id?: number; status: 'open' | 'closed';
  openedAt: string; closedAt?: string; openedBy: string; closedBy?: string;
  openingFloat: number;
  /** Snapshot of the expected cash, computed when the session is closed. */
  cashSales?: number; cashInvoices?: number; cashReturns?: number;
  deposits?: number; withdrawals?: number;
  expected?: number; counted?: number; difference?: number;
  note?: string; adjustments?: CashAdjustment[]; createdAt: string;
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
export interface PurchaseOrderItem { productId: number; name: string; quantity: number; quantityReceived: number; cost: number }
export interface PurchaseOrder {
  id?: number; number: string; providerId?: number; providerName: string; status: PurchaseOrderStatus;
  date: string; expectedDate?: string; receivedAt?: string; items: PurchaseOrderItem[]; total: number;
  notes?: string; createdAt: string;
}

/** One proposed sale/repair priced for the customer, reused when they accept it. */
export interface Quote {
  id?: number; number: string; date: string; expiresAt?: string;
  customerName: string; customerPhone?: string; customerEmail?: string; customerId?: number;
  device?: string; imei?: string;
  kind: 'sale' | 'repair';
  status: QuoteStatus;
  /** Prere-drafted line for a prospective sale or repair item. */
  items: { name: string; quantity: number; price: number }[];
  estimatedCost?: number; /** for repairs */
  problem?: string;       /** for repairs */
  total: number;
  notes?: string;
  convertedToSaleId?: number;
  convertedToRepairId?: number;
  userName?: string;
  createdAt: string;
}

/** One automatic daily backup of the whole database (`sys_daily_backup`). */
export interface DailySnapshot { id?: number; date: string; json: string; size: number; createdAt: string }
export interface Customer {
  id?: number; name: string; phone: string; email?: string; address?: string; dni?: string; notes?: string;
  totalSpent: number; visits: number; loyaltyPoints: number; createdAt: string;
}
export interface Provider {
  id?: number; name: string; contact: string; phone: string; email?: string; address?: string; cif?: string; notes?: string; createdAt: string;
}
export interface Expense { id?: number; date: string; category: ExpenseCategory; description: string; amount: number; createdAt: string }
/** One message handed to the server relay, kept until it is sent or given up on. */
export interface OutboxEntry {
  id?: number; channel: ChannelId; to: string; subject?: string; body: string;
  status: 'pending' | 'sent' | 'failed'; attempts: number; lastError?: string;
  reference?: string; createdAt: string; updatedAt: string;
}

export interface ReturnItem { productId: number; name: string; quantity: number; price: number; cost: number }
/** Refund of one sale: the stock given back and the reason. */
export interface SaleReturn {
  id?: number; saleId?: number; ticketNumber: string; date: string;
  items: ReturnItem[]; total: number; reason?: string;
  restocked: boolean; invoiceId?: number; userName?: string; createdAt: string;
}
export interface InvoiceItem { description: string; quantity: number; price: number; taxRate: number; total: number }
export interface Invoice {
  id?: number; number: string; date: string; dueDate: string; customerName: string; customerDni: string;
  customerAddress: string; customerEmail: string; items: InvoiceItem[]; subtotal: number; totalTax: number; total: number;
  paid: number; status: InvoiceStatus; paymentMethod: PaymentMethod; notes?: string; saleId?: number; repairId?: number; createdAt: string;
}
export interface ProductCategory { id: string; name: string; icon: string; color: string; isDefault?: boolean }
export interface PrinterConfig {
  enabled: boolean; name: string; connection: PrinterConnection; width: '80mm' | '58mm'; header?: string; showLogo?: boolean;
}
export interface NormalPrinterConfig {
  enabled: boolean; name: string; connection: PrinterConnection; paper: 'A4' | 'Letter'; color: boolean; copies: number; watermark?: string;
}
/** How the store reaches WhatsApp: a plain wa.me deep link, or the Cloud API credentials. */
export type WhatsAppMode = 'link' | 'cloud';
export type MailProvider = 'gmail' | 'outlook' | 'smtp';
export type ChannelId = 'whatsapp' | 'email';
/** `off` = channel disabled · `incomplete` = enabled but missing fields · `ready` = usable. */
export type ChannelStatus = 'off' | 'incomplete' | 'ready';
export interface WhatsAppChannel {
  enabled: boolean; mode: WhatsAppMode; phone: string; phoneNumberId: string; token: string; template: string;
}
export interface EmailChannel {
  enabled: boolean; provider: MailProvider; fromName: string; fromAddress: string;
  host: string; port: number; secure: boolean; user: string; password: string; subject: string; template: string;
}
export interface Channels { whatsapp: WhatsAppChannel; email: EmailChannel }
export interface Settings {
  id?: number; storeName: string; cif: string; address: string; phone: string; email: string;
  currency: string; currencySymbol: string; taxRate: number; ticketFooter?: string;
  invoicePrefix: string; invoiceNumbering: InvoiceNumbering; invoiceCustomFormat?: string; invoiceDigits: number;
  invoiceNextNumber: number; invoiceLastYear?: number; invoiceDefaultDueDays: number; invoiceDefaultStatus: InvoiceStatus;
  invoiceDefaultPaymentMethod: PaymentMethod; invoiceDefaultNotes?: string; invoiceIncludeRepairDetail: boolean;
  invoiceAutoGenerateOnDelivery: boolean; invoiceYearReset: boolean;
  /** Euros of spend that earn one loyalty point. */
  loyaltyRate: number;
  /** Inactivity minutes before the screen locks. 0 (or missing) keeps it disabled. */
  lockAfterMinutes?: number;
  /** Warranty length in days offered on sales, used by the IMEI dossier. */
  warrantyDays?: number;
  /** Branding: application name (sidebar, login, tab title) and optional store logo as a data URL. */
  appName?: string; logo?: string;
  /** Internal marker used to seed new demo tables once, without wiping user data. */
  seedVersion?: number;
  ticketPrinter?: PrinterConfig; normalPrinter?: NormalPrinterConfig;
  categories?: ProductCategory[]; automations?: Record<string, boolean>;
  /** Delivery channels consumed by the `whatsapp` and `email` automations. */
  channels?: Channels;
}
export interface User {
  id?: number; name: string; email: string; password: string; role: Role; permissions: NavSection[];
  avatar?: string; isActive: boolean; lastLogin?: string; createdAt: string;
}
export interface AuditLog { id?: number; userId: number; userName: string; action: string; module: string; details?: string; timestamp: string; ip?: string }
export interface AppNotification {
  id?: number; type: NotificationType; title: string; message: string; params?: Record<string, string | number>;
  read: boolean; createdAt: string; relatedId?: string;
}
export type { AppNotification as Notification };

export const ALL_MODULES: NavSection[] = [
  'dashboard', 'pos', 'cash', 'inventory', 'stock', 'repairs', 'quotes', 'clients', 'providers', 'purchases', 'expenses',
  'billing', 'reports', 'users', 'notifications', 'automations', 'settings',
];

export const QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];
export const QUOTE_STATUS_ICONS: Record<QuoteStatus, string> = {
  draft: '📝', sent: '📤', accepted: '✅', rejected: '❌', expired: '⏰', converted: '🔁',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, NavSection[]> = {
  admin: [...ALL_MODULES],
  manager: ['dashboard', 'pos', 'cash', 'inventory', 'stock', 'repairs', 'quotes', 'clients', 'providers', 'purchases', 'expenses', 'billing', 'reports', 'notifications', 'automations'],
  technician: ['dashboard', 'inventory', 'stock', 'repairs', 'quotes', 'notifications'],
  cashier: ['dashboard', 'pos', 'cash', 'quotes', 'clients', 'notifications'],
};
/** Modules that a role can open but not modify */
export const READ_ONLY_MODULES: Partial<Record<Role, NavSection[]>> = { technician: ['inventory'] };

export const ROLES: Role[] = ['admin', 'manager', 'technician', 'cashier'];
export const ROLE_ICONS: Record<Role, string> = { admin: '👑', manager: '💼', technician: '🔧', cashier: '💰' };

export const REPAIR_STATUSES: RepairStatus[] = ['received', 'diagnosis', 'in_progress', 'waiting_parts', 'completed', 'delivered', 'cancelled'];
export const REPAIR_STATUS_ICONS: Record<RepairStatus, string> = {
  received: '📥', diagnosis: '🔍', in_progress: '🛠️', waiting_parts: '⏳', completed: '✅', delivered: '📦', cancelled: '❌',
};
export const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'];
export const INVOICE_STATUS_ICONS: Record<InvoiceStatus, string> = {
  draft: '📝', sent: '📤', paid: '✅', partial: '💰', overdue: '⚠️', cancelled: '❌',
};
export const EXPENSE_CATEGORIES: { id: ExpenseCategory; icon: string }[] = [
  { id: 'rent', icon: '🏠' }, { id: 'utilities', icon: '⚡' }, { id: 'material', icon: '📦' }, { id: 'payroll', icon: '💼' },
  { id: 'marketing', icon: '📢' }, { id: 'maintenance', icon: '🔧' }, { id: 'other', icon: '📋' },
];
export const PAYMENT_METHODS: { id: PaymentMethod; icon: string }[] = [
  { id: 'cash', icon: '💵' }, { id: 'card', icon: '💳' }, { id: 'transfer', icon: '🏦' }, { id: 'other', icon: '🔁' },
];
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  stock_critical: '🚨', stock_low: '⚠️', repair_overdue: '🔧', invoice_overdue: '💰', daily_summary: '📊', system: 'ℹ️',
};
export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_ICONS) as NotificationType[];
export const STOCK_MOVE_TYPES: StockMoveType[] = ['initial', 'sale', 'purchase', 'adjustment', 'create', 'delete', 'repair', 'return'];
export const STOCK_MOVE_ICONS: Record<StockMoveType, string> = {
  initial: '🏁', sale: '🛒', purchase: '🚚', adjustment: '✏️', create: '➕', delete: '🗑️', repair: '🔧', return: '↩️',
};
export const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = ['draft', 'sent', 'partial', 'received', 'cancelled'];
export const PURCHASE_STATUS_ICONS: Record<PurchaseOrderStatus, string> = {
  draft: '📝', sent: '📤', partial: '📦', received: '✅', cancelled: '❌',
};
export const CURRENCIES: { code: string; symbol: string }[] = [
  { code: 'EUR', symbol: '€' }, { code: 'USD', symbol: '$' }, { code: 'GBP', symbol: '£' }, { code: 'MXN', symbol: '$' },
  { code: 'ARS', symbol: '$' }, { code: 'COP', symbol: '$' }, { code: 'CLP', symbol: '$' }, { code: 'BRL', symbol: 'R$' },
  { code: 'CNY', symbol: '¥' }, { code: 'MAD', symbol: 'DH' },
];
export const ACCENTS: Accent[] = ['default', 'green', 'red', 'blue', 'purple', 'orange'];