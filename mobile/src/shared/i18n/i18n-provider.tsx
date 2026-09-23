import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { type Locale, type MessageKey, messages } from './messages';

const localeKey = 'margins.locale';

type I18nContextValue = {
  locale: Locale;
  setLocale(locale: Locale): Promise<void>;
  t(key: MessageKey): string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function systemLocale(): Locale {
  return getLocales()[0]?.languageCode === 'ko' ? 'ko' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale | null>(null);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(localeKey)
      .then((stored) => {
        if (mounted) setLocaleState(stored === 'ko' || stored === 'en' ? stored : systemLocale());
      })
      .catch(() => {
        if (mounted) setLocaleState(systemLocale());
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setLocale = useCallback(async (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    await AsyncStorage.setItem(localeKey, nextLocale);
  }, []);

  const value = useMemo<I18nContextValue | null>(
    () => locale ? { locale, setLocale, t: (key) => messages[locale][key] } : null,
    [locale, setLocale],
  );

  if (!value) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
