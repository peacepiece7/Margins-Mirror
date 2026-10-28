import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/shared/accessibility/use-reduced-motion';
import { colors, radius, spacing } from '@/shared/theme/tokens';
import { AppText } from '@/shared/ui';
import type { Locale } from '@/shared/i18n/messages';

import { booksCopy } from './copy';
import { BookRatingDisplay } from './book-rating-display';
import type { SavedBook } from './types';

export function BookCard({ book, locale, onPress }: { book: SavedBook; locale: Locale; onPress(): void }) {
  const c = booksCopy(locale);
  const reducedMotion = useReducedMotion();
  const accessibleRating = book.rating == null
    ? undefined
    : localizedRating(Math.max(0, Math.min(5, book.rating)), locale, c.rating);
  const accessibleValue = [book.readingStatus ? c.status[book.readingStatus] : undefined, accessibleRating]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityHint={locale === 'ko' ? '책 세부 정보 열기' : 'Open book details'}
      accessibilityLabel={locale === 'ko' ? `${book.title}, 저자 ${book.author}` : `${book.title}, by ${book.author}`}
      accessibilityRole="button"
      accessibilityValue={accessibleValue ? { text: accessibleValue } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        pressed && !reducedMotion && styles.pressedMotion,
      ]}
      testID="library-book-card"
    >
      {book.coverImageUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={locale === 'ko' ? `${book.title} 표지` : `${book.title} cover`}
          source={{ uri: book.coverImageUrl }}
          style={styles.cover}
        />
      ) : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.coverFallback}>
          <AppText variant="title">{book.title.slice(0, 1).toUpperCase()}</AppText>
        </View>
      )}
      <View style={styles.copy}>
        <AppText numberOfLines={2} variant="heading">
          {book.title}
        </AppText>
        <AppText numberOfLines={2} variant="caption">
          {book.author}
        </AppText>
        {book.readingStatus ? (
          <AppText style={[styles.status, statusStyles[book.readingStatus]]} variant="label">
            {c.status[book.readingStatus]}
          </AppText>
        ) : null}
        {book.rating != null ? <BookRatingDisplay rating={book.rating} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.x3,
    minHeight: 98,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x4,
  },
  copy: {
    flex: 1,
    gap: spacing.x1,
    justifyContent: 'center',
    minWidth: 0,
  },
  cover: {
    backgroundColor: colors.line,
    borderRadius: radius.small,
    height: 66,
    width: 46,
  },
  coverFallback: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: radius.small,
    height: 66,
    justifyContent: 'center',
    width: 46,
  },
  pressed: {
    opacity: 0.78,
  },
  pressedMotion: {
    transform: [{ translateY: 1 }],
  },
  status: {
    alignSelf: 'flex-start',
    letterSpacing: 0.45,
  },
});

const statusStyles = StyleSheet.create({
  dnf: { color: colors.danger },
  read: { color: colors.success },
  reading: { color: colors.statusReading },
  want_to_read: { color: colors.navy },
});

function localizedRating(rating: number, locale: Locale, ratingLabel: string) {
  return locale === 'ko'
    ? `${ratingLabel}: 5점 만점에 ${rating}점`
    : `${ratingLabel}: ${rating} out of 5`;
}
