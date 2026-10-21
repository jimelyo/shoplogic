import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'en', name: 'English', flag: '🇬🇧', rtl: false },
  { code: 'pt', name: 'Português', flag: '🇵🇹', rtl: false },
  { code: 'zh', name: '中文', flag: '🇨🇳', rtl: false },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const saved = localStorage.getItem('sl_lang');
const initialLng: LanguageCode = LANGUAGES.some((l) => l.code === saved) ? (saved as LanguageCode) : 'es';

export function applyDir(lng: string) {
  const rtl = LANGUAGES.find((l) => l.code === lng)?.rtl;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
}

/**
 * Loads one locale on demand. Keeping the five ~1,000-key dictionaries out of
 * the initial chunk saves ~65 KB gzip on first paint; the active language is
 * fetched before React renders and switches are lazy too.
 */
async function localeModule(lng: LanguageCode) {
  switch (lng) {
    case 'en': return (await import('./en')).default;
    case 'pt': return (await import('./pt')).default;
    case 'zh': return (await import('./zh')).default;
    case 'ar': return (await import('./ar')).default;
    default: return (await import('./es')).default;
  }
}

let initPromise: Promise<void> | null = null;
let initialized = false;

/** Loads a locale into i18next if it is not already there. */
export async function loadLanguage(lng: LanguageCode): Promise<void> {
  if (i18n.hasResourceBundle(lng, 'translation')) return;
  const translation = await localeModule(lng);
  i18n.addResourceBundle(lng, 'translation', translation, true, true);
}

/** Initializes i18next once, before the first React render. */
export function initI18n(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const translation = await localeModule(initialLng);
    await i18n.use(initReactI18next).init({
      resources: { [initialLng]: { translation } },
      lng: initialLng,
      // Every shipped locale has the same key set (check:i18n), so a missing
      // fallback language would only mask real translation gaps.
      fallbackLng: false,
      nsSeparator: false,
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    initialized = true;
    applyDir(initialLng);
    i18n.on('languageChanged', (l) => {
      localStorage.setItem('sl_lang', l);
      applyDir(l);
    });
  })();
  return initPromise;
}

/** Loads and activates a language; use this from the language picker. */
export async function changeLanguage(lng: LanguageCode): Promise<void> {
  if (!initialized) await initI18n();
  await loadLanguage(lng);
  await i18n.changeLanguage(lng);
}

export default i18n;
