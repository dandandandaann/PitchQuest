/* eslint-disable react-refresh/only-export-components -- single-module i18n API:
   hooks intentionally co-located with their provider. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TranslationKey } from './keys';
import { en } from './dictionaries/en';
import { pt } from './dictionaries/pt';

export type Locale = 'en' | 'pt';

const STORAGE_KEY = 'pq.lang';
const PT_LOCALE_RE = /^pt\b/i;

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, pt };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a key in the current locale. */
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Initial locale: persisted preference first, then browser-language
 * detection (any `pt*` navigator language → pt). Falls back to `en`.
 * All storage access is guarded — Safari private mode and SSR can throw.
 */
function detectInitialLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'pt') return stored;
  } catch {
    // localStorage unavailable — fall through to detection.
  }
  if (typeof navigator !== 'undefined' && PT_LOCALE_RE.test(navigator.language)) {
    return 'pt';
  }
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore — persistence is best-effort.
    }
    document.documentElement.lang = next;
  }, []);

  // Keep <html lang> in sync with the initial (detected) locale too.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: TranslationKey) => dictionaries[locale][key], [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Current locale ('en' | 'pt'). Must be used inside {@link I18nProvider}. */
export function useLocale(): Locale {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLocale must be used within an I18nProvider');
  return ctx.locale;
}

/** Translate a key in the current locale. Must be used inside {@link I18nProvider}. */
export function useT(): (key: TranslationKey) => string {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within an I18nProvider');
  return ctx.t;
}
