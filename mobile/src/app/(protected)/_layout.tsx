import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useBooksQuery } from '@/features/books/queries';
import { useReducedMotion } from '@/shared/accessibility/use-reduced-motion';
import { useI18n } from '@/shared/i18n/i18n-provider';
import type { Locale } from '@/shared/i18n/messages';
import { ProtectedBottomNavigation } from '@/shared/navigation/protected-bottom-navigation';
import { ProtectedUtilityNavigation } from '@/shared/navigation/protected-utility-navigation';
import { colors, fontFamilies } from '@/shared/theme/tokens';
import { FlashAlertProvider } from '@/shared/ui';

export function protectedStackTitles(locale: Locale) {
  return locale === 'ko'
    ? {
        book: '책 정보', debate: '페르소나 토론', guide: '토론 가이드', interview: '회고 인터뷰',
        memoryCards: '메모리 카드', reading: '독서 작업실', reflection: '회고', refine: '회고 다듬기',
        review: '리뷰', study: '학습', discuss: '가이드 토론',
      }
    : {
        book: 'Book', debate: 'Persona debate', guide: 'Discussion guide', interview: 'Reflection interview',
        memoryCards: 'Memory Cards', reading: 'Reading workspace', reflection: 'Reflection', refine: 'Refine reflection',
        review: 'Review', study: 'Study', discuss: 'Guided discussion',
      };
}

export default function ProtectedLayout() {
  const { locale } = useI18n();
  const reducedMotion = useReducedMotion();
  const books = useBooksQuery();
  const titles = protectedStackTitles(locale);
  return (
    <View style={styles.shell}>
      <ProtectedUtilityNavigation bookCount={books.data?.books.length} />
      <FlashAlertProvider>
        <Stack
          screenOptions={{
            animation: reducedMotion ? 'none' : 'default',
            contentStyle: { backgroundColor: colors.canvas },
            headerBackButtonDisplayMode: 'minimal',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.canvas },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontFamily: fontFamilies.serif, fontSize: 18, fontWeight: '500' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="books/[bookId]" options={{ title: titles.book }} />
          <Stack.Screen name="books/[bookId]/session" options={{ headerShown: false }} />
          <Stack.Screen name="books/[bookId]/reflection/index" options={{ headerShown: false }} />
          <Stack.Screen name="books/[bookId]/reflection/interview" options={{ headerShown: false }} />
          <Stack.Screen name="books/[bookId]/reflection/guide/[guideId]" options={{ headerShown: false }} />
          <Stack.Screen name="books/[bookId]/reflection/discuss/[runId]" options={{ headerShown: false }} />
          <Stack.Screen name="books/[bookId]/reflection/refine/[runId]" options={{ headerShown: false }} />
          <Stack.Screen name="books/[bookId]/debates/index" options={{ headerShown: false }} />
          <Stack.Screen name="books/[bookId]/debates/[windowId]" options={{ headerShown: false }} />
          <Stack.Screen name="reviews/[insightId]" options={{ title: titles.review }} />
          <Stack.Screen name="memory-cards/index" options={{ headerShown: false }} />
          <Stack.Screen name="memory-cards/[groupId]" options={{ headerShown: false }} />
          <Stack.Screen name="memory-cards/[groupId]/study" options={{ headerShown: false }} />
        </Stack>
      </FlashAlertProvider>
      <ProtectedBottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
});
