import { Stack } from 'expo-router';

import { useReducedMotion } from '@/shared/accessibility/use-reduced-motion';
import { useI18n } from '@/shared/i18n/i18n-provider';
import type { Locale } from '@/shared/i18n/messages';
import { colors } from '@/shared/theme/tokens';

export function publicStackTitles(locale: Locale) {
  return locale === 'ko'
    ? { privacy: '개인정보 처리방침', recovery: '계정 복구', signup: '회원가입' }
    : { privacy: 'Privacy', recovery: 'Account recovery', signup: 'Sign up' };
}

export default function PublicLayout() {
  const { locale } = useI18n();
  const reducedMotion = useReducedMotion();
  const titles = publicStackTitles(locale);
  return (
    <Stack
      screenOptions={{
        animation: reducedMotion ? 'none' : 'default',
        contentStyle: { backgroundColor: colors.canvas },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ title: titles.signup }} />
      <Stack.Screen name="privacy" options={{ title: titles.privacy }} />
      <Stack.Screen name="recovery" options={{ title: titles.recovery }} />
      <Stack.Screen name="oauth/google" options={{ headerShown: false }} />
    </Stack>
  );
}
