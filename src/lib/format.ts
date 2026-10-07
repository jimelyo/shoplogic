import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { es, enGB, pt, zhCN, arSA } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { db, DEFAULT_SETTINGS } from '../db/database';
import type { Settings } from '../types';

export const DATE_LOCALES: Record<string, Locale> = { es, en: enGB, pt, zh: zhCN, ar: arSA };
export const NUM_LOCALES: Record<string, string> = { es: 'es-ES', en: 'en-GB', pt: 'pt-PT', zh: 'zh-CN', ar: 'ar-u-nu-latn' };
const PREFIX_SYMBOLS = ['$', '£', '¥', 'R$'];

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.toCollection().first(), []);
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...(s ?? {}) }), [s]);
}

const place = (num: string, sym: string) => (PREFIX_SYMBOLS.includes(sym) ? `${sym}${num}` : `${num} ${sym}`);

export function formatMoney(n: number, s: Pick<Settings, 'currencySymbol'>, lang = 'es'): string {
  const v = Number.isFinite(n) ? n : 0;
  const num = new Intl.NumberFormat(NUM_LOCALES[lang] ?? 'es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  return place(num, s.currencySymbol);
}

/** ASCII-safe money string for PDF output */
export function plainMoney(n: number, s: Pick<Settings, 'currencySymbol'>): string {
  const v = Number.isFinite(n) ? n : 0;
  const num = v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return place(num, s.currencySymbol);
}

export function toDate(d?: string | Date): Date | null {
  if (!d) return null;
  const x = d instanceof Date ? d : d.length <= 10 ? parseISO(d) : new Date(d);
  return isNaN(x.getTime()) ? null : x;
}

export function safeFormat(d: string | Date | undefined, f: string, locale?: Locale): string {
  const x = toDate(d);
  return x ? format(x, f, locale ? { locale } : undefined) : '—';
}

export function useFormat() {
  const settings = useSettings();
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useMemo(() => {
    const locale = DATE_LOCALES[lang] ?? es;
    return {
      settings,
      lang,
      locale,
      money: (n: number) => formatMoney(n, settings, lang),
      date: (d?: string) => safeFormat(d, 'dd/MM/yyyy'),
      dateTime: (d?: string) => safeFormat(d, 'dd/MM/yyyy HH:mm'),
      number: (n: number) => new Intl.NumberFormat(NUM_LOCALES[lang] ?? 'es-ES').format(n),
    };
  }, [settings, lang]);
}