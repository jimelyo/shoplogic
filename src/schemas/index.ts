import { z } from 'zod';

/** Basic input sanitization against HTML/script injection */
export const sanitize = (s: string) =>
  s.replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+\s*=/gi, '').trim();

const text = () => z.string().transform(sanitize);
const req = (min = 1) => text().pipe(z.string().min(min, min > 1 ? 'validation.min2' : 'validation.required'));
const opt = () => z.string().optional().transform((v) => (v ? sanitize(v) : undefined));
const optEmail = () =>
  z.string().optional().transform((v) => (v ? sanitize(v) : '')).pipe(z.union([z.literal(''), z.string().email('validation.email')]));
const money = () => z.coerce.number({ invalid_type_error: 'validation.positive' }).min(0, 'validation.positive');
const int = () => z.coerce.number({ invalid_type_error: 'validation.integer' }).int('validation.integer').min(0, 'validation.positive');
const optMoney = () =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : v), z.coerce.number().min(0, 'validation.positive').optional());

export const loginSchema = z.object({
  email: req().pipe(z.string().email('validation.email')),
  password: req(),
});

export const productSchema = z.object({
  name: req(2), category: req(), barcode: text(), imei: opt(),
  cost: money(), price: money(), stock: int(), minStock: int(), description: opt(),
});

export const categorySchema = z.object({ name: req(2), icon: req(), color: req() });

export const customerSchema = z.object({
  name: req(2), phone: req(), email: optEmail(), address: opt(), dni: opt(), notes: opt(),
});

export const providerSchema = z.object({
  name: req(2), contact: req(), phone: req(), email: optEmail(), address: opt(), cif: opt(), notes: opt(),
});

export const repairSchema = z.object({
  customerName: req(2), customerPhone: req(), customerEmail: optEmail(), device: req(), imei: text(),
  problem: req(), diagnosis: opt(), notes: opt(),
  status: z.enum(['received', 'diagnosis', 'in_progress', 'waiting_parts', 'completed', 'delivered', 'cancelled']),
  estimatedCost: money(), finalCost: optMoney(),
});

export const expenseSchema = z.object({
  date: req(),
  category: z.enum(['rent', 'utilities', 'material', 'payroll', 'marketing', 'maintenance', 'other']),
  description: req(),
  amount: z.coerce.number({ invalid_type_error: 'validation.positive' }).positive('validation.positive'),
});

export const invoiceItemSchema = z.object({
  description: req(),
  quantity: z.coerce.number().positive('validation.positive'),
  price: money(), taxRate: money(), total: money(),
});

export const invoiceSchema = z.object({
  customerName: req(2), customerDni: text(), customerAddress: text(), customerEmail: optEmail(),
  date: req(), dueDate: req(),
  status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled']),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']),
  notes: opt(),
  items: z.array(invoiceItemSchema).min(1, 'validation.minItems'),
});

export const purchaseOrderLineSchema = z.object({
  productId: z.coerce.number({ invalid_type_error: 'validation.required' }).int('validation.integer').positive('validation.required'),
  quantity: z.coerce.number({ invalid_type_error: 'validation.integer' }).int('validation.integer').min(1, 'validation.positive'),
  cost: money(),
});

export const quoteLineSchema = z.object({
  name: req(),
  quantity: z.coerce.number().int('validation.integer').min(1, 'validation.positive'),
  price: money(),
});

export const quoteSchema = z.object({
  customerName: req(2),
  customerPhone: text(),
  customerEmail: optEmail(),
  kind: z.enum(['sale', 'repair']),
  device: opt(),
  imei: opt(),
  problem: opt(),
  expiresAt: z.string().optional().transform((v) => (v && v.trim() ? v : undefined)),
  notes: opt(),
  items: z.array(quoteLineSchema).min(1, 'validation.minItems'),
});

export const purchaseOrderSchema = z.object({
  providerId: z.coerce.number({ invalid_type_error: 'validation.required' }).int('validation.integer').positive('validation.required'),
  date: req(),
  expectedDate: z.string().optional().transform((v) => (v && v.trim() ? v : undefined)),
  notes: opt(),
  items: z.array(purchaseOrderLineSchema).min(1, 'validation.minItems'),
});

export const userSchema = z.object({
  name: req(2),
  email: req().pipe(z.string().email('validation.email')),
  password: z.string().optional().transform((v) => v ?? '').pipe(z.union([z.literal(''), z.string().min(6, 'validation.min6')])),
  role: z.enum(['admin', 'manager', 'technician', 'cashier']),
  isActive: z.boolean(),
  permissions: z.array(z.string()),
});

export type FormErrors = Record<string, string>;
export type ValidationResult<T> = { success: true; data: T; errors: FormErrors } | { success: false; data?: undefined; errors: FormErrors };

export function validateForm<S extends z.ZodTypeAny>(schema: S, data: unknown): ValidationResult<z.output<S>> {
  const r = schema.safeParse(data);
  if (r.success) return { success: true, data: r.data, errors: {} };
  const errors: FormErrors = {};
  for (const issue of r.error.issues) {
    const k = issue.path.join('.') || '_';
    if (!errors[k]) errors[k] = issue.message.startsWith('validation.') ? issue.message : 'validation.required';
  }
  return { success: false, errors };
}