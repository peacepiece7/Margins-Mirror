import { SymbolView } from 'expo-symbols';
import { Controller, useForm } from 'react-hook-form';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ApiRequestError } from '@/shared/api/error';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { colors, fontFamilies, radius, spacing } from '@/shared/theme/tokens';
import {
  AppText,
  Button,
  EditorialHeader,
  Notice,
  Screen,
  Surface,
  TextField,
  useFlashAlert,
} from '@/shared/ui';

import { booksCopy, candidateProviderLabel, candidateSummaryLabel } from './copy';
import {
  useBooksQuery,
  useBookSearchQuery,
  useSaveBookMutation,
  useSaveManualBookMutation,
} from './queries';
import type { BookCandidate, ReadingStatus, SavedBook } from './types';

type SearchForm = { query: string };
type ManualForm = { author: string; isbn: string; title: string };

const readingStatuses = ['want_to_read', 'reading', 'read', 'dnf'] as const;

type SavedBookIndex = {
  byIsbn: ReadonlyMap<string, SavedBook>;
  bySourceRef: ReadonlyMap<string, SavedBook>;
};

export function buildSavedBookIndex(books: SavedBook[]): SavedBookIndex {
  const byIsbn = new Map<string, SavedBook>();
  const bySourceRef = new Map<string, SavedBook>();
  books.forEach((book) => {
    if (book.sourceRef) bySourceRef.set(book.sourceRef, book);
    const isbn = normalizeIsbn(book.isbn);
    if (isbn) byIsbn.set(isbn, book);
  });
  return { byIsbn, bySourceRef };
}

export function findSavedBook(candidate: BookCandidate, index: SavedBookIndex) {
  const sourceMatch = index.bySourceRef.get(candidate.candidateId);
  if (sourceMatch) return sourceMatch;
  for (const candidateIsbn of [candidate.isbn, candidate.isbn13, candidate.isbn10]) {
    const isbnMatch = index.byIsbn.get(normalizeIsbn(candidateIsbn) ?? '');
    if (isbnMatch) return isbnMatch;
  }
  return undefined;
}

export function DiscoverScreen({
  onOpenBook,
  onSaved,
}: {
  onOpenBook(bookId: number): void;
  onSaved(): void;
}) {
  const { locale, t } = useI18n();
  const { showAlert } = useFlashAlert();
  const c = booksCopy(locale);
  const searchForm = useForm<SearchForm>({ defaultValues: { query: '' } });
  const manualForm = useForm<ManualForm>({
    defaultValues: { author: '', isbn: '', title: '' },
  });
  const [committedQuery, setCommittedQuery] = useState('');
  const [hideSavedBooks, setHideSavedBooks] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, ReadingStatus>>({});
  const books = useBooksQuery();
  const search = useBookSearchQuery(committedQuery);
  const save = useSaveBookMutation();
  const saveManual = useSaveManualBookMutation();
  const savedBooksReady = books.data !== undefined && !books.isError;
  const savePending = save.isPending || saveManual.isPending;

  const candidates = search.data?.pages.flatMap((page) => page.candidates) ?? [];
  const totalCandidates = search.data?.pages[0]?.totalItems ?? candidates.length;
  const savedBookIndex = useMemo(
    () => buildSavedBookIndex(books.data?.books ?? []),
    [books.data?.books],
  );
  const visibleCandidates = savedBooksReady
    ? hideSavedBooks
      ? candidates.filter((candidate) => !findSavedBook(candidate, savedBookIndex))
      : candidates
    : [];
  const candidateSummary = candidates.length > 0
    ? candidateSummaryLabel(
      candidates.map((candidate) => candidate.candidateId),
      locale,
      totalCandidates,
    )
    : null;
  const submitSearch = searchForm.handleSubmit(({ query }) => {
    setCommittedQuery(query.trim());
  });
  const submitManual = manualForm.handleSubmit(async (values) => {
    if (!savedBooksReady || savePending) return;
    try {
      await saveManual.mutateAsync(values);
      manualForm.reset();
      onSaved();
    } catch (error) {
      showAlert({
        dismissLabel: t('dismissNotification'),
        message: mutationErrorMessage(error, t),
        tone: 'error',
      });
    }
  });

  function saveCandidate(candidate: BookCandidate) {
    if (!savedBooksReady || savePending) return;
    save.mutate({
      candidate,
      readingStatus: selectedStatuses[candidate.candidateId] ?? 'want_to_read',
    }, {
      onError: (error) => showAlert({
        dismissLabel: t('dismissNotification'),
        message: mutationErrorMessage(error, t),
        tone: 'error',
      }),
      onSuccess: onSaved,
    });
  }

  return (
    <Screen includeTopInset layout="edge" scroll={false} testID="discover-screen">
      <EditorialHeader
        description={t('discoverSubtitle')}
        eyebrow={`${t('discover')} · ${t('searchBooks')}`}
        page
        title={t('discoverTitle')}
      />
      <View style={styles.searchShell} testID="discover-fixed-search">
        <Controller
          control={searchForm.control}
          name="query"
          render={({ field: { onBlur, onChange, value }, fieldState }) => (
            <>
              <View style={styles.searchRow}>
                <TextInput
                  accessibilityLabel={t('searchBooks')}
                  autoCapitalize="none"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => void submitSearch()}
                  placeholder={t('searchPlaceholder')}
                  placeholderTextColor={colors.muted}
                  returnKeyType="search"
                  style={styles.searchInput}
                  testID="discover-search-input"
                  value={value}
                />
                <Pressable
                  accessibilityLabel={t('searchBooks')}
                  accessibilityRole="button"
                  accessibilityState={{ busy: search.isFetching }}
                  onPress={() => void submitSearch()}
                  style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
                  testID="discover-search-submit"
                >
                  <SymbolView
                    accessibilityElementsHidden
                    fallback={<AppText style={styles.searchFallback}>⌕</AppText>}
                    importantForAccessibility="no-hide-descendants"
                    name={{ android: 'search', ios: 'magnifyingglass' }}
                    size={20}
                    tintColor={colors.accentDeep}
                  />
                </Pressable>
              </View>
              {fieldState.error ? (
                <AppText accessibilityLiveRegion="polite" style={styles.error} variant="caption">
                  {fieldState.error.message}
                </AppText>
              ) : null}
            </>
          )}
          rules={{ required: t('searchRequired') }}
        />
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={visibleCandidates}
        keyExtractor={(candidate) => candidate.candidateId}
        testID="book-candidate-list"
        ListEmptyComponent={
          savedBooksReady
          && !search.isError
          && (committedQuery || (hideSavedBooks && candidates.length > 0))
          && !search.isFetching ? (
            <Notice title={candidates.length > 0 && hideSavedBooks ? c.noNewCandidates : t('noSearchResults')} />
          ) : null
        }
        ListFooterComponent={
          <View>
            {search.isFetchingNextPage ? <Notice title={t('loadingMore')} /> : null}
            <Surface variant="section">
              <AppText variant="heading">{t('manualAdd')}</AppText>
              <Controller
                control={manualForm.control}
                name="title"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    error={manualForm.formState.errors.title?.message}
                    label={t('bookTitle')}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
                rules={{ required: t('fieldRequired') }}
              />
              <Controller
                control={manualForm.control}
                name="author"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    error={manualForm.formState.errors.author?.message}
                    label={t('author')}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    onSubmitEditing={() => void submitManual()}
                    value={value}
                  />
                )}
                rules={{ required: t('fieldRequired') }}
              />
              <Controller
                control={manualForm.control}
                name="isbn"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    autoCapitalize="none"
                    label={c.manualIsbn}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    onSubmitEditing={() => void submitManual()}
                    value={value}
                  />
                )}
              />
              <Button
                disabled={!savedBooksReady || save.isPending}
                loading={saveManual.isPending}
                onPress={() => void submitManual()}
                variant="outline"
              >
                {t('addBook')}
              </Button>
            </Surface>
          </View>
        }
        ListHeaderComponent={
          books.isLoading
          || books.isError
          || search.isFetching
          || search.isError
          || candidateSummary
          || candidates.length > 0 ? (
            <View>
              {!savedBooksReady && books.isLoading ? <Notice title={c.libraryCheckPending} /> : null}
              {!savedBooksReady && books.isError ? (
                <View style={styles.recoveryNotice}>
                  <Notice title={c.libraryCheckError} tone="error" />
                  <Button onPress={() => void books.refetch()} variant="outline">
                    {t('retry')}
                  </Button>
                </View>
              ) : null}
              {committedQuery && search.isFetching && !search.isFetchingNextPage ? (
                <View
                  accessibilityLabel={c.searchPending}
                  accessibilityRole="progressbar"
                  style={styles.loadingRow}
                  testID="discover-search-loading"
                >
                  <ActivityIndicator color={colors.accentDeep} size="small" />
                  <AppText variant="caption">{c.searchPending}</AppText>
                </View>
              ) : null}
              {search.isError ? (
                <View style={styles.recoveryNotice}>
                  <Notice title={t('genericError')} tone="error" />
                  <Button onPress={() => void search.refetch()} variant="outline">
                    {t('retry')}
                  </Button>
                </View>
              ) : null}
              {candidateSummary ? (
                <View
                  accessibilityLabel={candidateSummary}
                  style={styles.resultSummary}
                  testID="discover-result-summary"
                >
                  <AppText style={styles.resultSummaryText} variant="caption">
                    {candidateSummary}
                  </AppText>
                </View>
              ) : null}
              {candidates.length > 0 ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: hideSavedBooks }}
                  onPress={() => setHideSavedBooks((hidden) => !hidden)}
                  style={({ pressed }) => [styles.filterToggle, pressed && styles.pressed]}
                  testID="discover-hide-saved"
                >
                  <View style={[styles.checkbox, hideSavedBooks && styles.checkboxSelected]} />
                  <AppText variant="caption">{c.hideSavedBooks}</AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null
        }
        onEndReached={() => {
          if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        renderItem={({ item }) => {
          const savedBook = findSavedBook(item, savedBookIndex);
          const selectedStatus = selectedStatuses[item.candidateId] ?? 'want_to_read';
          return (
          <Surface
            style={[styles.result, savedBook && styles.savedResult]}
            testID={`book-candidate-${item.candidateId}`}
            variant="section"
          >
            <View style={styles.candidate}>
              {item.thumbnail ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${item.title} ${c.cover}`}
                  source={{ uri: item.thumbnail }}
                  style={styles.cover}
                  testID="candidate-cover"
                />
              ) : (
                <View accessibilityElementsHidden style={styles.coverFallback}>
                  <AppText variant="title">{item.title.slice(0, 1).toUpperCase()}</AppText>
                </View>
              )}
              <View style={styles.candidateCopy}>
                <AppText variant="heading">{item.title}</AppText>
                {item.subtitle ? <AppText testID="candidate-subtitle">{item.subtitle}</AppText> : null}
                <AppText>{item.author}</AppText>
                <AppText variant="caption">{candidateProviderLabel(item.candidateId, locale)}</AppText>
                <AppText testID="candidate-id" variant="caption">
                  {c.candidateId}: {item.candidateId}
                </AppText>
                {item.isbn ?? item.isbn13 ?? item.isbn10 ? (
                  <AppText testID="candidate-isbn" variant="caption">
                    {c.isbn}: {item.isbn ?? item.isbn13 ?? item.isbn10}
                  </AppText>
                ) : null}
                {item.publishedDate || item.publishedYear ? (
                  <AppText testID="candidate-publication" variant="caption">
                    {item.publishedDate ?? item.publishedYear}
                  </AppText>
                ) : null}
                {item.publisher ? (
                  <AppText testID="candidate-publisher" variant="caption">
                    {c.publisher}: {item.publisher}
                  </AppText>
                ) : null}
                {item.language ? (
                  <AppText testID="candidate-language" variant="caption">
                    {c.language}: {item.language}
                  </AppText>
                ) : null}
                {item.pageCount != null ? (
                  <AppText testID="candidate-page-count" variant="caption">
                    {c.pages}: {item.pageCount}
                  </AppText>
                ) : null}
              </View>
            </View>
            {savedBook ? (
              <>
                <AppText style={styles.savedState} testID="candidate-saved-state" variant="label">
                  {c.alreadyInLibrary} · {c.status[savedBook.readingStatus ?? 'want_to_read']}
                </AppText>
                <Button onPress={() => onOpenBook(savedBook.bookId)} variant="outline">
                  {c.openInLibrary}
                </Button>
              </>
            ) : (
              <>
                <AppText variant="label">{c.chooseReadingStatus}</AppText>
                <View accessibilityRole="radiogroup" style={styles.statusOptions}>
                  {readingStatuses.map((status) => {
                    const selected = selectedStatus === status;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: selected,
                          disabled: savePending,
                        }}
                        disabled={savePending}
                        key={status}
                        onPress={() => setSelectedStatuses((current) => ({
                          ...current,
                          [item.candidateId]: status,
                        }))}
                        style={({ pressed }) => [
                          styles.statusOption,
                          selected && styles.statusOptionSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <AppText style={selected ? styles.statusOptionTextSelected : undefined} variant="caption">
                          {c.status[status]}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <Button
                  disabled={savePending}
                  loading={save.isPending && save.variables?.candidate.candidateId === item.candidateId}
                  onPress={() => saveCandidate(item)}
                  variant="outline"
                >
                  {t('addBook')}
                </Button>
              </>
            )}
          </Surface>
          );
        }}
      />
    </Screen>
  );
}

function normalizeIsbn(value?: string) {
  const normalized = value?.replace(/[^0-9Xx]/g, '').toUpperCase();
  return normalized || undefined;
}

function mutationErrorMessage(
  error: unknown,
  t: (key: 'bookAlreadyExists' | 'genericError') => string,
) {
  return error instanceof ApiRequestError && error.code === 'BOOK_ALREADY_EXISTS'
    ? t('bookAlreadyExists')
    : t('genericError');
}

const styles = StyleSheet.create({
  candidate: {
    flexDirection: 'row',
    gap: spacing.x3,
  },
  candidateCopy: {
    flex: 1,
    gap: spacing.x1,
    minWidth: 0,
  },
  cover: {
    backgroundColor: colors.line,
    borderRadius: radius.small,
    height: 120,
    width: 80,
  },
  coverFallback: {
    alignItems: 'center',
    backgroundColor: colors.line,
    borderRadius: radius.small,
    height: 120,
    justifyContent: 'center',
    width: 80,
  },
  error: {
    color: colors.danger,
  },
  list: {
    flexGrow: 1,
    paddingBottom: spacing.x8,
  },
  loadingRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.x2,
    minHeight: 48,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x3,
  },
  pressed: {
    opacity: 0.55,
  },
  result: {
    paddingVertical: spacing.x4 + spacing.x1,
  },
  savedResult: {
    backgroundColor: colors.surface,
  },
  savedState: {
    color: colors.accentDeep,
  },
  statusOption: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.x2,
  },
  statusOptionSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  statusOptionTextSelected: {
    color: colors.accentDeep,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.x2,
  },
  checkbox: {
    borderColor: colors.accent,
    borderRadius: radius.small,
    borderWidth: 1,
    height: 18,
    width: 18,
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderWidth: 4,
  },
  filterToggle: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.x2,
    minHeight: 44,
    paddingHorizontal: spacing.x5,
  },
  resultSummary: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x3,
  },
  resultSummaryText: {
    color: colors.muted,
    fontFamily: fontFamilies.sans,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  recoveryNotice: {
    gap: spacing.x2,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x3,
  },
  searchButton: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: radius.medium,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  searchFallback: {
    color: colors.accentDeep,
    fontFamily: fontFamilies.sans,
    fontSize: 20,
    lineHeight: 22,
  },
  searchInput: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.medium,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.serif,
    fontSize: 16,
    height: 48,
    minWidth: 0,
    paddingHorizontal: spacing.x3,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.x2,
  },
  searchShell: {
    backgroundColor: colors.canvas,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.x1,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
  },
});
