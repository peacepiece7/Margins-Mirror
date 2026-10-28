import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';

import { AppText } from '@/shared/ui';

import { I18nProvider, useI18n } from './i18n-provider';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

function LocaleProbe() {
  const { locale, t } = useI18n();
  return <AppText>{`${locale}:${t('library')}`}</AppText>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('I18nProvider hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getLocales).mockReturnValue([{ languageCode: 'en' }] as unknown as ReturnType<typeof getLocales>);
  });

  it('does not mount children in the system locale before a saved locale is read', async () => {
    const stored = deferred<string | null>();
    jest.mocked(AsyncStorage.getItem).mockReturnValue(stored.promise);
    const view = await render(<I18nProvider><LocaleProbe /></I18nProvider>);

    expect(view.queryByText(/Library|서재/)).toBeNull();
    await act(async () => stored.resolve('ko'));

    expect(view.getByText('ko:서재')).toBeTruthy();
  });

  it('falls back to the device locale when storage cannot be read', async () => {
    jest.mocked(getLocales).mockReturnValue([{ languageCode: 'ko' }] as unknown as ReturnType<typeof getLocales>);
    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('storage unavailable'));
    const view = await render(<I18nProvider><LocaleProbe /></I18nProvider>);

    expect(await view.findByText('ko:서재')).toBeTruthy();
  });
});
