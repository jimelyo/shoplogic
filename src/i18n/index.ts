import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './es';
import en from './en';
import pt from './pt';
import zh from './zh';
import ar from './ar';

export const LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'en', name: 'English', flag: '🇬🇧', rtl: false },
  { code: 'pt', name: 'Português', flag: '🇵🇹', rtl: false },
  { code: 'zh', name: '中文', flag: '🇨🇳', rtl: false },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
] as const;

const saved = localStorage.getItem('sl_lang');
const initialLng = LANGUAGES.some((l) => l.code === saved) ? (saved as string) : 'es';

export function applyDir(lng: string) {
  const rtl = LANGUAGES.find((l) => l.code === lng)?.rtl;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
}

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en }, pt: { translation: pt }, zh: { translation: zh }, ar: { translation: ar } },
  lng: initialLng,
  fallbackLng: 'es',
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyDir(initialLng);
i18n.on('languageChanged', (l) => {
  localStorage.setItem('sl_lang', l);
  applyDir(l);
});

export default i18n;