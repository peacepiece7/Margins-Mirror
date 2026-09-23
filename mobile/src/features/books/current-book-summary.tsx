import { Image, Pressable, StyleSheet, View } from 'react-native';

import type { Locale } from '@/shared/i18n/messages';
import { colors, radius, spacing } from '@/shared/theme/tokens';
import { AppText } from '@/shared/ui';

import type { SavedBook } from './types';

export function CurrentBookSummary({
  book,
  locale = 'en',
  onPress,
}: {
  book: SavedBook;
  locale?: Locale;
  onPress?(): void;
}) {
  const content = (
    <View style={styles.row}>
      {book.coverImageUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={locale === 'ko' ? `${book.title} 표지` : `${book.title} cover`}
          source={{ uri: book.coverImageUrl }}
          style={styles.cover}
          testID="current-book-cover"
        />
      ) : (
        <View accessibilityElementsHidden style={styles.coverFallback}>
          <AppText variant="title">{book.title.slice(0, 1).toUpperCase()}</AppText>
        </View>
      )}
      <View style={styles.copy}>
        <AppText variant="heading">{book.title}</AppText>
        {book.subtitle ? <AppText testID="current-book-subtitle">{book.subtitle}</AppText> : null}
        <AppText variant="caption">{book.author}</AppText>
      </View>
    </View>
  );

  if (!onPress) {
    return <View style={styles.summary} testID="current-book-summary">{content}</View>;
  }

  return (
    <Pressable
      accessibilityHint={locale === 'ko' ? '읽던 책 열기' : 'Open the book you are reading'}
      accessibilityLabel={locale === 'ko' ? `${book.title}, 계속 읽기` : `${book.title}, continue reading`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      testID="current-book-summary"
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: spacing.x1, minWidth: 0 },
  cover: {
    backgroundColor: colors.line,
    borderRadius: radius.small,
    height: 108,
    width: 74,
  },
  coverFallback: {
    alignItems: 'center',
    backgroundColor: colors.line,
    borderRadius: radius.small,
    height: 108,
    justifyContent: 'center',
    width: 74,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.x3 },
  pressed: { opacity: 0.72 },
  summary: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x5,
  },
});
