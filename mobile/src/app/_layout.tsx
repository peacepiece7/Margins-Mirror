import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthSessionProvider, useAuthSession } from '@/features/auth/session-provider';
import { rootRouteAccess } from '@/features/auth/route-access';
import { useReducedMotion } from '@/shared/accessibility/use-reduced-motion';
import { I18nProvider } from '@/shared/i18n/i18n-provider';
import { colors } from '@/shared/theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AuthSessionProvider>
            <StatusBar style="dark" />
            <RootStack />
          </AuthSessionProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function RootStack() {
  const { status } = useAuthSession();
  const reducedMotion = useReducedMotion();
  const access = rootRouteAccess(status);

  return (
    <Stack
      screenOptions={{
        animation: reducedMotion ? 'none' : 'default',
        contentStyle: { backgroundColor: colors.canvas },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        headerTitleStyle: { color: colors.ink },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ headerShown: false }} />
      <Stack.Screen name="privacy-history" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
      <Stack.Screen name="terms-history" options={{ headerShown: false }} />
      <Stack.Protected guard={access.publicAuth}>
        <Stack.Screen name="(public)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={access.consent}>
        <Stack.Screen name="consent" options={{ headerShown: false }} />
        <Stack.Screen name="consent-account" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={access.protected}>
        <Stack.Screen name="(protected)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
