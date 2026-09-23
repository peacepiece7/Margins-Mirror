import { SymbolView } from 'expo-symbols';
import { router, useGlobalSearchParams, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/shared/i18n/i18n-provider';
import { colors, spacing } from '@/shared/theme/tokens';
import { AppText } from '@/shared/ui';

type GlobalDestination = 'account' | 'debate' | 'library' | 'reflection' | 'study';

const destinations = [
  {
    fallback: '▥', href: '/library',
    icon: { android: 'collections_bookmark', ios: 'books.vertical' },
    key: 'library', label: 'shelfNav', testID: 'global-navigation-library',
  },
  {
    fallback: '◇', href: '/reflection',
    icon: { android: 'edit_note', ios: 'text.book.closed' },
    key: 'reflection', label: 'reflectionNav', testID: 'global-navigation-reflection',
  },
  {
    fallback: '◎', href: '/library?action=debate',
    icon: { android: 'forum', ios: 'bubble.left.and.bubble.right' },
    key: 'debate', label: 'debateNav', testID: 'global-navigation-debate',
  },
  {
    fallback: '▤', href: '/library?action=study',
    icon: { android: 'school', ios: 'rectangle.stack' },
    key: 'study', label: 'studyNav', testID: 'global-navigation-study',
  },
  {
    fallback: '○', href: '/account',
    icon: { android: 'account_circle', ios: 'person.crop.circle' },
    key: 'account', label: 'meNav', testID: 'global-navigation-account',
  },
] as const;

export function globalNavigationDestination(
  pathname: string,
  action?: string,
): GlobalDestination {
  if (pathname === '/library' && (action === 'reflection' || action === 'debate' || action === 'study')) {
    return action;
  }
  if (pathname.includes('/reflection/discuss/')) return 'debate';
  if (pathname.includes('/reflection')) return 'reflection';
  if (pathname.includes('/debates')) return 'debate';
  if (pathname.startsWith('/memory-cards')) return 'study';
  if (pathname === '/account') return 'account';
  return 'library';
}

export function ProtectedBottomNavigation() {
  const pathname = usePathname();
  const { action } = useGlobalSearchParams<{ action?: string }>();
  const { t } = useI18n();
  const activeDestination = globalNavigationDestination(pathname, action);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea} testID="protected-global-navigation">
      <View accessibilityRole="tablist" style={styles.navigation}>
        {destinations.map((destination) => {
          const selected = destination.key === activeDestination;
          return (
            <Pressable
              accessibilityLabel={t(destination.label)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={destination.key}
              onPress={() => router.navigate(destination.href as Href)}
              style={({ pressed }) => [
                styles.destination,
                selected && styles.selectedDestination,
                pressed && styles.pressedDestination,
              ]}
              testID={destination.testID}
            >
              <SymbolView
                accessibilityElementsHidden
                fallback={
                  <AppText style={[styles.fallbackIcon, selected && styles.selectedContent]}>
                    {destination.fallback}
                  </AppText>
                }
                importantForAccessibility="no-hide-descendants"
                name={destination.icon}
                size={20}
                tintColor={selected ? colors.accentDeep : colors.muted}
              />
              <AppText
                numberOfLines={1}
                style={[styles.label, selected && styles.selectedContent]}
                variant="caption"
              >
                {t(destination.label)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  destination: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 44,
    paddingHorizontal: spacing.x1,
    paddingVertical: spacing.x1,
  },
  fallbackIcon: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 20,
    textAlign: 'center',
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  navigation: {
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  pressedDestination: {
    backgroundColor: colors.canvas,
  },
  safeArea: {
    backgroundColor: colors.paper,
  },
  selectedContent: {
    color: colors.accentDeep,
  },
  selectedDestination: {
    borderTopColor: colors.accent,
    borderTopWidth: 1,
  },
});
