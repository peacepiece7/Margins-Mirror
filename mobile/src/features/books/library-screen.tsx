import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useI18n } from '@/shared/i18n/i18n-provider';
import { spacing } from '@/shared/theme/tokens';
import { AppText, Button, LoadingState, Notice, Screen, Surface } from '@/shared/ui';

import { BookCard } from './book-card';
import { booksCopy } from './copy';
import { CurrentBookSummary } from './current-book-summary';
import { useBooksQuery } from './queries';
import type { SavedBook } from './types';

export function LibraryScreen({
  onDismissSaved,
  onOpenBook,
  onOpenReviews,
  saved = false,
  selectionPrompt,
}: {
  onDismissSaved?(): void;
  onOpenBook(book: SavedBook): void;
  onOpenReviews?(): void;
  saved?: boolean;
  selectionPrompt?: string;
}) {
  const { locale, t } = useI18n();
  const c = booksCopy(locale);
  const [savedVisible, setSavedVisible] = useState(saved);
  const books = useBooksQuery();
  const savedBooks = books.data?.books ?? [];
  const currentBook = savedBooks.find((book) => book.readingStatus === 'reading');

  if (books.isLoading) return <LoadingState label={t('library')} />;

  return (
    <Screen layout="edge" scroll={false} testID="library-screen">
      {currentBook ? (
        <CurrentBookSummary
          book={currentBook}
          locale={locale}
          onPress={() => onOpenBook(currentBook)}
        />
      ) : null}
      {selectionPrompt ? (
        <Surface testID="library-selection-prompt" variant="section">
          <AppText accessibilityRole="header" variant="heading">{selectionPrompt}</AppText>
        </Surface>
      ) : null}
      {savedVisible ? (
        <View style={styles.savedFeedback} testID="saved-book-feedback">
          <Notice title={t('bookAdded')} tone="success" />
          <Button
            onPress={() => {
              setSavedVisible(false);
              onDismissSaved?.();
            }}
            testID="dismiss-saved-book-feedback"
            variant="ghost"
          >
            {c.dismissSavedFeedback}
          </Button>
        </View>
      ) : null}
      {!selectionPrompt && onOpenReviews ? (
        <Surface testID="library-public-reviews" variant="section">
          <View style={styles.reviewsRow}>
            <View style={styles.reviewsCopy}>
              <AppText accessibilityRole="header" variant="heading">{t('reviews')}</AppText>
              <AppText variant="caption">{t('reviewsDescription')}</AppText>
            </View>
            <Button onPress={onOpenReviews} testID="open-public-reviews" variant="outline">
              {t('reviews')}
            </Button>
          </View>
        </Surface>
      ) : null}
      {books.isError ? (
        <Notice title={t('bookLoadError')} tone="error">
          <Button onPress={() => void books.refetch()} variant="ghost">
            {t('retry')}
          </Button>
        </Notice>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={savedBooks}
          keyExtractor={(book) => String(book.bookId)}
          ListEmptyComponent={
            <Notice title={t('emptyLibrary')} />
          }
          onRefresh={() => void books.refetch()}
          refreshing={books.isRefetching}
          renderItem={({ item }) => (
            <BookCard
              book={item}
              locale={locale}
              onPress={() => onOpenBook(item)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingBottom: spacing.x8,
  },
  reviewsCopy: { flex: 1, gap: spacing.x1, minWidth: 0 },
  reviewsRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.x3 },
  savedFeedback: {
    gap: spacing.x1,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x3,
  },
});
