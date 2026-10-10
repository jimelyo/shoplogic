import Dexie, { type Table } from 'dexie';
import type {
  AppNotification, AuditLog, Customer, Expense, Invoice, Product, Provider, PurchaseOrder, PurchaseOrderStatus,
  CashSession, OutboxEntry, DailySnapshot, Quote, Repair, Sale, SaleReturn, Settings, StockMove, StockMoveType, User, PaymentMethod,
} from '../types';
import { DEFAULT_ROLE_PERMISSIONS } from '../types';
import { DEFAULT_CATEGORIES } from '../data/categories';
import { DEFAULT_AUTOMATIONS } from '../data/automations';
import { DEFAULT_CHANNELS } from '../data/channels';
import { computeInvoiceTotals, formatInvoiceNumber, isoDate, itemFromTotal, pad, round2 } from '../lib/calc';
import { hashPassword } from '../lib/hash';

export class ShopDB extends Dexie {
  products!: Table<Product, number>;
  sales!: Table<Sale, number>;
  repairs!: Table<Repair, number>;
  customers!: Table<Customer, number>;
  providers!: Table<Provider, number>;
  expenses!: Table<Expense, number>;
  invoices!: Table<Invoice, number>;
  settings!: Table<Settings, number>;
  users!: Table<User, number>;
  logs!: Table<AuditLog, number>;
  notifications!: Table<AppNotification, number>;
  purchaseOrders!: Table<PurchaseOrder, number>;
  stockMoves!: Table<StockMove, number>;
  cashSessions!: Table<CashSession, number>;
  returns!: Table<SaleReturn, number>;
  outbox!: Table<OutboxEntry, number>;
  snapshots!: Table<DailySnapshot, number>;
  quotes!: Table<Quote, number>;

  constructor() {
    super('shoplogic_pro');
    this.version(1).stores({
      products: '++id, name, category, barcode, imei, stock',
      sales: '++id, ticketNumber, date, customerId',
      repairs: '++id, ticketNumber, status, dateIn, customerName',
      customers: '++id, name, phone, email, dni',
      providers: '++id, name',
      expenses: '++id, date, category',
      invoices: '++id, number, date, status, saleId, repairId',
      settings: '++id',
      users: '++id, &email, role',
      logs: '++id, timestamp, userId, module',
      notifications: '++id, type, read, createdAt, relatedId',
    });
    this.version(2).stores({
      purchaseOrders: '++id, number, providerId, status, date',
      stockMoves: '++id, productId, type, timestamp',
    });
    this.version(3).stores({
      cashSessions: '++id, status, openedAt, closedAt',
    });
    this.version(4).stores({
      returns: '++id, saleId, ticketNumber, date',
    });
    this.version(5).stores({
      outbox: '++id, status, channel, createdAt',
    });
    this.version(6).stores({
      snapshots: '++id, &date',
    });
    this.version(7).stores({
      repairs: '++id, ticketNumber, status, dateIn, customerName, imei, customerId',
    });
    this.version(8).stores({
      quotes: '++id, number, status, date, customerId, kind',
    });
  }
}

export const db = new ShopDB();

export const TABLE_NAMES = [
  'products', 'sales', 'repairs', 'customers', 'providers', 'expenses', 'invoices', 'users', 'logs', 'notifications', 'settings',
  'purchaseOrders', 'stockMoves', 'cashSessions', 'returns', 'outbox', 'quotes',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'ShopLogic Mobile Store',
  appName: 'ShopLogic Pro',
  cif: 'B12345678',
  address: 'Calle Gran Vía 28, 28013 Madrid',
  phone: '910 000 000',
  email: 'info@shoplogic.com',
  currency: 'EUR',
  currencySymbol: '€',
  taxRate: 21,
  ticketFooter: '¡Gracias por su compra! Garantía de 2 años en dispositivos nuevos.',
  invoicePrefix: 'F',
  invoiceNumbering: 'year',
  invoiceCustomFormat: '{PREFIX}/{YYYY}/{NUM}',
  invoiceDigits: 4,
  invoiceNextNumber: 1,
  invoiceLastYear: new Date().getFullYear(),
  invoiceDefaultDueDays: 30,
  invoiceDefaultStatus: 'sent',
  invoiceDefaultPaymentMethod: 'transfer',
  invoiceDefaultNotes: 'Pago por transferencia bancaria: ES00 0000 0000 0000 0000 0000',
  invoiceIncludeRepairDetail: true,
  invoiceAutoGenerateOnDelivery: true,
  invoiceYearReset: true,
  loyaltyRate: 10,
  lockAfterMinutes: 0,
  warrantyDays: 90,
  ticketPrinter: { enabled: true, name: 'Epson TM-T20III', connection: 'usb', width: '80mm', header: 'ShopLogic Mobile Store', showLogo: true },
  normalPrinter: { enabled: true, name: 'HP LaserJet Pro', connection: 'network', paper: 'A4', color: true, copies: 1, watermark: '' },
  categories: DEFAULT_CATEGORIES,
  automations: DEFAULT_AUTOMATIONS,
  channels: DEFAULT_CHANNELS,
};

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.toCollection().first();
  if (s) return { ...DEFAULT_SETTINGS, ...s };
  const id = await db.settings.add({ ...DEFAULT_SETTINGS });
  return { ...DEFAULT_SETTINGS, id };
}

const now = new Date();
const daysAgo = (d: number, h = 12) => {
  const x = new Date(now);
  x.setDate(x.getDate() - d);
  x.setHours(h, 15, 0, 0);
  return x.toISOString();
};

export async function buildDemoData() {
  const created = now.toISOString();
  const products: Product[] = [
    { name: 'iPhone 15 Pro Max 256GB', category: 'phones', barcode: '8400000000011', imei: '356789012345671', cost: 1050, price: 1469, stock: 5, minStock: 2, description: 'Titanio natural', createdAt: created },
    { name: 'Samsung Galaxy S24 Ultra', category: 'phones', barcode: '8400000000028', imei: '356789012345682', cost: 950, price: 1359, stock: 3, minStock: 2, description: '12GB / 512GB', createdAt: created },
    { name: 'Xiaomi 14 Pro', category: 'phones', barcode: '8400000000035', imei: '356789012345693', cost: 620, price: 899, stock: 1, minStock: 2, description: '12GB / 256GB', createdAt: created },
    { name: 'Funda silicona iPhone 15', category: 'accessories', barcode: '8400000000042', cost: 4.5, price: 19.99, stock: 40, minStock: 10, createdAt: created },
    { name: 'Cable USB-C 2m', category: 'accessories', barcode: '8400000000059', cost: 2.1, price: 12.99, stock: 60, minStock: 15, createdAt: created },
    { name: 'Cargador rápido 30W', category: 'accessories', barcode: '8400000000066', cost: 9, price: 29.99, stock: 8, minStock: 10, createdAt: created },
    { name: 'Protector cristal templado', category: 'accessories', barcode: '8400000000073', cost: 1.2, price: 9.99, stock: 100, minStock: 20, createdAt: created },
    { name: 'Batería iPhone 13', category: 'parts', barcode: '8400000000080', cost: 18, price: 59, stock: 6, minStock: 3, createdAt: created },
    { name: 'Pantalla OLED Samsung S23', category: 'parts', barcode: '8400000000097', cost: 85, price: 189, stock: 0, minStock: 2, createdAt: created },
    { name: 'AirPods Pro 2', category: 'accessories', barcode: '8400000000103', cost: 190, price: 279, stock: 4, minStock: 2, createdAt: created },
    { name: 'Conector de carga Lightning', category: 'parts', barcode: '8400000000110', cost: 3.5, price: 25, stock: 12, minStock: 5, createdAt: created },
    { name: 'Pantalla LCD iPhone 11', category: 'parts', barcode: '8400000000127', cost: 32, price: 89, stock: 2, minStock: 3, createdAt: created },
  ];
  const customers: Customer[] = [
    { name: 'Carlos García', phone: '612345678', email: 'carlos.garcia@email.com', address: 'Calle Mayor 12, Madrid', dni: '12345678A', notes: 'Cliente habitual', totalSpent: 0, visits: 0, loyaltyPoints: 0, createdAt: daysAgo(60) },
    { name: 'María López', phone: '623456789', email: 'maria.lopez@email.com', address: 'Av. Diagonal 450, Barcelona', dni: '23456789B', totalSpent: 0, visits: 0, loyaltyPoints: 0, createdAt: daysAgo(50) },
    { name: 'Ahmed Ben Ali', phone: '634567890', email: 'ahmed.benali@email.com', address: 'Calle Sierpes 8, Sevilla', dni: 'X1234567L', totalSpent: 0, visits: 0, loyaltyPoints: 0, createdAt: daysAgo(40) },
    { name: 'Ana Martínez', phone: '645678901', email: 'ana.martinez@email.com', address: 'Plaza del Ayuntamiento 3, Valencia', dni: '34567890C', totalSpent: 0, visits: 0, loyaltyPoints: 0, createdAt: daysAgo(30) },
  ];
  const providers: Provider[] = [
    { name: 'TechDistribuciones S.L.', contact: 'Javier Ruiz', phone: '911223344', email: 'ventas@techdistribuciones.es', address: 'Polígono Industrial Sur, Madrid', cif: 'B12345678', notes: 'Smartphones y tablets', createdAt: created },
    { name: 'GlobalParts Asia Ltd.', contact: 'Li Wei', phone: '+86 755 1234 5678', email: 'sales@globalparts.asia', address: 'Futian District, Shenzhen (China)', cif: 'CN91440300', notes: 'Repuestos: pantallas, baterías, conectores', createdAt: created },
    { name: 'AccessoryWorld', contact: 'Laura Gómez', phone: '933445566', email: 'pedidos@accessoryworld.com', address: 'Carrer de Sants 120, Barcelona', cif: 'B87654321', notes: 'Fundas, cables y cargadores', createdAt: created },
  ];
  return { products, customers, providers };
}

let seeding: Promise<void> | null = null;
export function seedDatabase(force = false): Promise<void> {
  // A failed seeding must not be cached forever: clear it so the next call retries.
  if (!seeding || force) {
    const run = doSeed(force).catch((e) => { seeding = null; throw e; });
    seeding = run;
    return run;
  }
  return seeding;
}

async function doSeed(force: boolean) {
  const userCount = await db.users.count();
  if (userCount > 0 && !force) {
    await getSettings();
    await seedExtras();
    return;
  }
  const rate = 21;
  const created = now.toISOString();
  const { products, customers, providers } = await buildDemoData();
  // Passwords must be hashed BEFORE the transaction opens: awaiting crypto.subtle (a
  // native promise) inside a Dexie transaction makes Dexie consider the transaction
  // already committed and throw PrematureCommitError.
  const newUsers: User[] | null = (await db.users.count()) === 0
    ? [
        { name: 'Administrador', email: 'admin@shoplogic.com', password: await hashPassword('admin123'), role: 'admin', permissions: [...DEFAULT_ROLE_PERMISSIONS.admin], isActive: true, createdAt: daysAgo(90) },
        { name: 'Marta Manager', email: 'manager@shoplogic.com', password: await hashPassword('manager123'), role: 'manager', permissions: [...DEFAULT_ROLE_PERMISSIONS.manager], isActive: true, createdAt: daysAgo(80) },
        { name: 'Pedro Técnico', email: 'tecnico@shoplogic.com', password: await hashPassword('tecnico123'), role: 'technician', permissions: [...DEFAULT_ROLE_PERMISSIONS.technician], isActive: true, createdAt: daysAgo(70) },
        { name: 'Lucía Cajera', email: 'cajero@shoplogic.com', password: await hashPassword('cajero123'), role: 'cashier', permissions: [...DEFAULT_ROLE_PERMISSIONS.cashier], isActive: true, createdAt: daysAgo(60) },
      ]
    : null;

  await db.transaction('rw', [db.products, db.customers, db.providers, db.sales, db.repairs, db.expenses, db.invoices, db.settings, db.users, db.logs, db.notifications, db.purchaseOrders, db.stockMoves], async () => {
    if (force) {
      await Promise.all([db.products.clear(), db.customers.clear(), db.providers.clear(), db.sales.clear(), db.repairs.clear(), db.expenses.clear(), db.invoices.clear(), db.notifications.clear(), db.purchaseOrders.clear(), db.stockMoves.clear()]);
    }
    await db.products.bulkAdd(products);
    await db.customers.bulkAdd(customers);
    await db.providers.bulkAdd(providers);
    const P = await db.products.toArray();
    const C = await db.customers.toArray();
    const byName = (n: string) => P.find((p) => p.name.startsWith(n))!;

    const mkSale = (n: number, date: string, items: [Product, number][], pm: PaymentMethod, c?: Customer): Sale => {
      const its = items.map(([p, q]) => ({ productId: p.id!, name: p.name, category: p.category, quantity: q, price: p.price, cost: p.cost }));
      const total = round2(its.reduce((s, i) => s + i.price * i.quantity, 0));
      const subtotal = round2(total / (1 + rate / 100));
      return { ticketNumber: `T-${pad(n)}`, date, items: its, subtotal, tax: round2(total - subtotal), total, paymentMethod: pm, customerId: c?.id, customerName: c?.name, userName: 'Administrador' };
    };
    const sales: Sale[] = [
      mkSale(1, daysAgo(6, 11), [[byName('iPhone 15'), 1], [byName('Funda'), 1]], 'card', C[0]),
      mkSale(2, daysAgo(3, 17), [[byName('Cable'), 2], [byName('Protector'), 1]], 'cash', C[1]),
      mkSale(3, daysAgo(1, 13), [[byName('AirPods'), 1]], 'transfer', C[2]),
      mkSale(4, daysAgo(0, Math.max(9, now.getHours() - 1)), [[byName('Cargador'), 1], [byName('Funda'), 2]], 'cash', C[3]),
    ];
    const saleIds = (await db.sales.bulkAdd(sales, { allKeys: true })) as number[];
    for (const s of sales) {
      const c = C.find((x) => x.id === s.customerId);
      if (c) { c.totalSpent = round2(c.totalSpent + s.total); c.visits += 1; }
    }

    const repairs: Repair[] = [
      { ticketNumber: 'R-000001', dateIn: daysAgo(2, 10), customerName: C[0].name, customerPhone: C[0].phone, customerEmail: C[0].email, customerId: C[0].id, device: 'iPhone 13', imei: '353912110000001', problem: 'Pantalla rota tras caída', diagnosis: 'Cristal y OLED dañados, táctil no responde', notes: 'Cliente pide funda nueva', status: 'in_progress', estimatedCost: 129, createdAt: daysAgo(2, 10) },
      { ticketNumber: 'R-000002', dateIn: daysAgo(9, 16), customerName: C[1].name, customerPhone: C[1].phone, customerEmail: C[1].email, customerId: C[1].id, device: 'Samsung Galaxy A54', imei: '352345110000002', problem: 'No carga', diagnosis: 'Revisando conector de carga', status: 'diagnosis', estimatedCost: 45, createdAt: daysAgo(9, 16) },
      { ticketNumber: 'R-000003', dateIn: daysAgo(5, 12), dateOut: daysAgo(1, 18), customerName: C[3].name, customerPhone: C[3].phone, customerEmail: C[3].email, customerId: C[3].id, device: 'Xiaomi Redmi Note 12', imei: '861234050000003', problem: 'Batería se agota muy rápido', diagnosis: 'Batería degradada (62%). Sustituida.', status: 'completed', estimatedCost: 59, finalCost: 59, createdAt: daysAgo(5, 12) },
    ];
    const repairIds = (await db.repairs.bulkAdd(repairs, { allKeys: true })) as number[];
    await db.customers.bulkPut(C);

    await db.expenses.bulkAdd([
      { date: isoDate(new Date(daysAgo(20))), category: 'rent', description: 'Alquiler del local', amount: 1200, createdAt: daysAgo(20) },
      { date: isoDate(new Date(daysAgo(12))), category: 'utilities', description: 'Factura de electricidad', amount: 185.4, createdAt: daysAgo(12) },
      { date: isoDate(new Date(daysAgo(8))), category: 'material', description: 'Herramientas y material de taller', amount: 340, createdAt: daysAgo(8) },
      { date: isoDate(new Date(daysAgo(5))), category: 'payroll', description: 'Nómina técnico', amount: 2400, createdAt: daysAgo(5) },
      { date: isoDate(new Date(daysAgo(2))), category: 'marketing', description: 'Campaña en redes sociales', amount: 150, createdAt: daysAgo(2) },
    ]);

    const settingsBase = { ...DEFAULT_SETTINGS };
    const num = (n: number, d: string) => formatInvoiceNumber(settingsBase, n, new Date(d));
    const s1 = sales[0];
    const inv = (data: Omit<Invoice, 'subtotal' | 'totalTax' | 'total'>): Invoice => ({ ...data, ...computeInvoiceTotals(data.items) });
    const items1 = s1.items.map((i) => itemFromTotal(i.name, i.quantity, i.price * i.quantity, rate));
    const t1 = computeInvoiceTotals(items1).total;
    const invoices: Invoice[] = [
      inv({ number: num(1, s1.date), date: isoDate(new Date(s1.date)), dueDate: isoDate(new Date(daysAgo(-24))), customerName: C[0].name, customerDni: C[0].dni!, customerAddress: C[0].address!, customerEmail: C[0].email!, items: items1, paid: t1, status: 'paid', paymentMethod: 'card', saleId: saleIds[0], createdAt: s1.date }),
      inv({ number: num(2, daysAgo(10)), date: isoDate(new Date(daysAgo(10))), dueDate: isoDate(new Date(daysAgo(-20))), customerName: C[1].name, customerDni: C[1].dni!, customerAddress: C[1].address!, customerEmail: C[1].email!, items: [itemFromTotal('Cambio de pantalla Samsung A34', 1, 120, rate), itemFromTotal('Protector cristal templado', 3, 29.97, rate)], paid: 50, status: 'partial', paymentMethod: 'transfer', notes: 'Pago fraccionado acordado', createdAt: daysAgo(10) }),
      inv({ number: num(3, daysAgo(45)), date: isoDate(new Date(daysAgo(45))), dueDate: isoDate(new Date(daysAgo(15))), customerName: C[2].name, customerDni: C[2].dni!, customerAddress: C[2].address!, customerEmail: C[2].email!, items: [itemFromTotal('Reparación placa base iPhone 12', 1, 180, rate)], paid: 0, status: 'overdue', paymentMethod: 'transfer', createdAt: daysAgo(45) }),
      inv({ number: num(4, daysAgo(1)), date: isoDate(new Date(daysAgo(1))), dueDate: isoDate(new Date(daysAgo(-29))), customerName: C[3].name, customerDni: C[3].dni!, customerAddress: C[3].address!, customerEmail: C[3].email!, items: [itemFromTotal('Reparación Xiaomi Redmi Note 12 — Batería se agota muy rápido', 1, 59, rate)], paid: 0, status: 'sent', paymentMethod: 'transfer', repairId: repairIds[2], createdAt: daysAgo(1) }),
    ];
    await db.invoices.bulkAdd(invoices);

    const existing = await db.settings.toCollection().first();
    if (existing) await db.settings.update(existing.id!, { invoiceNextNumber: 5, invoiceLastYear: now.getFullYear() });
    else await db.settings.add({ ...DEFAULT_SETTINGS, invoiceNextNumber: 5 });

    if (newUsers) {
      await db.users.bulkAdd(newUsers);
      await db.logs.add({ userId: 0, userName: 'Sistema', action: 'create', module: 'settings', details: 'Base de datos inicializada con datos demo', timestamp: created, ip: 'local' });
    }

    await db.notifications.bulkAdd([
      { type: 'stock_critical', title: 'notif.stockCriticalTitle', message: 'notif.stockCriticalMsg', params: { count: 1, names: 'Pantalla OLED Samsung S23' }, read: false, createdAt: daysAgo(0, 9) },
      { type: 'repair_overdue', title: 'notif.repairOverdueTitle', message: 'notif.repairOverdueMsg', params: { ticket: 'R-000002', device: 'Samsung Galaxy A54', days: 7 }, read: false, createdAt: daysAgo(1, 9), relatedId: 'R-000002' },
      { type: 'invoice_overdue', title: 'notif.invoiceOverdueTitle', message: 'notif.invoiceOverdueMsg', params: { number: invoices[2].number, customer: C[2].name, amount: '180,00 €' }, read: false, createdAt: daysAgo(2, 9), relatedId: invoices[2].number },
      { type: 'system', title: 'notif.welcomeTitle', message: 'notif.welcomeMsg', read: true, createdAt: daysAgo(3, 9) },
    ]);
  });

  await seedExtras();
}

/** Bumped whenever the new demo tables get content, so already-seeded installs fill them once. */
const SEED_VERSION = 2;

/**
 * Seeds demo data for purchase orders, stock history and loyalty points.
 * Runs at most once per browser (tracked in `settings.seedVersion`) and never
 * touches user-created records: each block only fills a table that is still empty.
 */
async function seedExtras() {
  const s = await getSettings();
  if ((s.seedVersion ?? 0) >= SEED_VERSION) return;
  const rate = s.loyaltyRate || 10;

  // Everything runs in one transaction so seeding is atomic: either all demo data
  // lands together or none of it does (this also serialises against the app's own
  // concurrent reads while it boots).
  await db.transaction('rw', [db.settings, db.customers, db.purchaseOrders, db.stockMoves, db.products, db.sales, db.providers], async () => {
    // Loyalty points: derived from what each customer has already spent.
    const customers = await db.customers.toArray();
    for (const c of customers) {
      const pts = Math.floor(c.totalSpent / rate);
      if (c.loyaltyPoints !== pts) await db.customers.update(c.id!, { loyaltyPoints: pts });
    }

    // Purchase orders.
    if ((await db.purchaseOrders.count()) === 0) {
      const providers = await db.providers.toArray();
      const products = await db.products.toArray();
      const prod = (n: string) => products.find((p) => p.name.startsWith(n));
      const prov = (n: string) => providers.find((p) => p.name.startsWith(n));
      const mk = (n: number, providerName: string, status: PurchaseOrderStatus, date: string, lines: [Product | undefined, number, number][], expectedDate?: string): PurchaseOrder => {
        const items = lines.filter((l) => !!l[0]).map(([p, quantity, cost]) => ({ productId: p!.id!, name: p!.name, quantity, quantityReceived: status === 'received' ? quantity : 0, cost }));
        return {
          number: `PO-${pad(n)}`, providerId: prov(providerName)?.id, providerName, status,
          date: isoDate(new Date(date)), expectedDate, receivedAt: status === 'received' ? date : undefined,
          items, total: round2(items.reduce((a, i) => a + i.quantity * i.cost, 0)), createdAt: date,
        };
      };
      await db.purchaseOrders.bulkAdd([
        mk(1, 'TechDistribuciones', 'sent', daysAgo(2, 10), [[prod('Xiaomi 14 Pro'), 5, 620]], isoDate(new Date(daysAgo(-5)))),
        mk(2, 'AccessoryWorld', 'draft', daysAgo(1, 16), [[prod('Cargador rápido'), 20, 9], [prod('Cable USB-C'), 30, 2.1]], isoDate(new Date(daysAgo(-7)))),
        mk(3, 'GlobalParts Asia', 'received', daysAgo(7, 9), [[prod('Batería iPhone 13'), 4, 18]]),
      ]);
    }

    // Stock ledger: only when empty. Reconstructs a plausible history whose final
    // level matches the stock currently stored on every product.
    if ((await db.stockMoves.count()) === 0) {
      const products = await db.products.toArray();
      const sales = await db.sales.toArray();
      const received = (await db.purchaseOrders.toArray()).filter((o) => o.status === 'received' && o.receivedAt);
      const byName = (n: string) => products.find((p) => p.name.startsWith(n));
      const adjustments = [
        { product: byName('Cable USB-C'), qty: -2, note: 'Merma por rotura', when: daysAgo(4, 17) },
        { product: byName('Protector'), qty: 5, note: 'Ajuste tras inventario físico', when: daysAgo(3, 9) },
      ].filter((a) => !!a.product);

      type Event = { productId: number; productName: string; type: StockMoveType; qty: number; reference?: string; note?: string; userName?: string; timestamp: string };
      const perProduct = new Map<number, Event[]>();
      const push = (e: Event) => { const cur = perProduct.get(e.productId); if (cur) cur.push(e); else perProduct.set(e.productId, [e]); };

      const delta = new Map<number, number>();
      const add = (id: number, q: number) => delta.set(id, (delta.get(id) ?? 0) + q);
      for (const o of received) for (const it of o.items) add(it.productId, it.quantity);
      for (const a of adjustments) add(a.product!.id!, a.qty);
      for (const sale of sales) for (const it of sale.items) add(it.productId, -it.quantity);

      for (const p of products) {
        const opening = Math.max(0, p.stock - (delta.get(p.id!) ?? 0));
        push({ productId: p.id!, productName: p.name, type: 'initial', qty: opening, reference: 'Stock inicial', userName: 'Sistema', timestamp: daysAgo(90, 8) });
      }
      for (const o of received) for (const it of o.items) push({ productId: it.productId, productName: it.name, type: 'purchase', qty: it.quantity, reference: o.number, note: o.providerName, userName: 'Administrador', timestamp: o.receivedAt! });
      for (const a of adjustments) push({ productId: a.product!.id!, productName: a.product!.name, type: 'adjustment', qty: a.qty, note: a.note, userName: 'Administrador', timestamp: a.when });
      for (const sale of sales) for (const it of sale.items) push({ productId: it.productId, productName: it.name, type: 'sale', qty: -it.quantity, reference: sale.ticketNumber, userName: sale.userName, timestamp: sale.date });

      const moves: StockMove[] = [];
      for (const events of perProduct.values()) {
        events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        let running = 0;
        for (const e of events) {
          const before = running;
          running += e.qty;
          moves.push({ ...e, stockBefore: before, stockAfter: running });
        }
      }
      if (moves.length) await db.stockMoves.bulkAdd(moves);
    }

    await db.settings.update(s.id!, { seedVersion: SEED_VERSION });
  });
}