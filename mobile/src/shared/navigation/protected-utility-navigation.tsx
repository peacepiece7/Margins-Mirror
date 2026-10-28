import { SymbolView } from 'expo-symbols';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/shared/i18n/i18n-provider';
import { colors, fontFamilies, spacing } from '@/shared/theme/tokens';
import { AppText } from '@/shared/ui';

export function ProtectedUtilityNavigation({ bookCount }: { bookCount?: number }) {
  const pathname = usePathname();
  const { t } = useI18n();

  if (pathname === '/discover') return null;

  const countLabel = bookCount === undefined ? '…' : String(bookCount);
  const noun = bookCount === 1 ? 'book' : 'books';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} testID="protected-utility-navigation">
      <View accessibilityRole="toolbar" style={styles.navigation}>
        <Pressable
          accessibilityLabel={t('library')}
          accessibilityRole="button"
          onPress={() => router.navigate('/library')}
          style={({ pressed }) => [styles.shelfControl, pressed && styles.pressed]}
          testID="utility-navigation-shelf"
        >
          <AppText numberOfLines={1} style={styles.shelfLabel} variant="label">
            My shelf · {countLabel} {noun}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityLabel={t('searchBooks')}
          accessibilityRole="button"
          onPress={() => router.navigate('/discover')}
          style={({ pressed }) => [styles.searchControl, pressed && styles.pressed]}
          testID="utility-navigation-search"
        >
          <SymbolView
            accessibilityElementsHidden
            fallback={<AppText style={styles.fallbackIcon}>⌕</AppText>}
            importantForAccessibility="no-hide-descendants"
            name={{ android: 'search', ios: 'magnifyingglass' }}
            size={20}
            tintColor={colors.ink}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fallbackIcon: {
    color: colors.ink,
    fontFamily: fontFamilies.sans,
    fontSize: 20,
    lineHeight: 24,
  },
  navigation: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: spacing.x4,
  },
  pressed: {
    opacity: 0.55,
  },
  safeArea: {
    backgroundColor: colors.canvas,
  },
  searchControl: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  shelfControl: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 0,
  },
  shelfLabel: {
    color: colors.accentDeep,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    letterSpacing: 0.2,
    lineHeight: 18,
  },
});
