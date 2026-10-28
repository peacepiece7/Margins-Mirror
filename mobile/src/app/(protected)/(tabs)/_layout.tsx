import { Tabs } from 'expo-router';

import { useReducedMotion } from '@/shared/accessibility/use-reduced-motion';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { colors } from '@/shared/theme/tokens';

export default function TabLayout() {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  return (
    <Tabs
      screenOptions={{
        animation: reducedMotion ? 'none' : 'fade',
        headerShown: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        tabBarActiveTintColor: colors.accentDeep,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="library" options={{ title: t('library') }} />
      <Tabs.Screen name="reflection" options={{ title: t('reflectionNav') }} />
      <Tabs.Screen name="discover" options={{ title: t('discover') }} />
      <Tabs.Screen name="reviews" options={{ title: t('reviews') }} />
      <Tabs.Screen name="account" options={{ title: t('account') }} />
    </Tabs>
  );
}
