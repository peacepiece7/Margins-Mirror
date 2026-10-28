import { SymbolView } from 'expo-symbols';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/shared/i18n/i18n-provider';
import { ApiRequestError } from '@/shared/api/error';
import { colors, radius, spacing } from '@/shared/theme/tokens';
import {
  AppText,
  Button,
  ConfirmActionDialog,
  LoadingState,
  Notice,
  Screen,
  Surface,
  TextField,
} from '@/shared/ui';
import { AiProcessingNotice } from '@/shared/ui/ai-processing-notice';

import { BookRatingInput } from './book-rating-input';
import { booksCopy } from './copy';
import { CurrentBookSummary } from './current-book-summary';
import {
  useBookKnowledgeQuery,
  useBookQuery,
  useDeleteBookMutation,
  useRegenerateBookKnowledgeMutation,
  useUpdateBookMutation,
  useUpdateBookShelfMutation,
} from './queries';
import type {
  BookDebateRecommendation,
  BookKnowledge,
  ReadingStatus,
  SavedBook,
} from './types';

type BookMetadataRow = { label: string; value: string };

export function debateRecommendationForPoint(
  knowledge: BookKnowledge,
  discussionPointId: string,
): BookDebateRecommendation | undefined {
  const point = knowledge.discussionPoints.find((candidate) => candidate.id === discussionPointId);
  if (!point) return undefined;
  const aggregateKeys = knowledge.recommendedPersonas.find(
    (recommendation) => recommendation.discussionPointId === discussionPointId,
  )?.personaKeys;
  const personaKeys = (point.recommendedPersonaKeys?.length
    ? point.recommendedPersonaKeys
    : aggregateKeys ?? [])
    .map(normalizePersonaKey)
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .slice(0, 2);
  return { personaKeys, topic: point.question };
}

function normalizePersonaKey(key: string) {
  return key.trim().toLocaleLowerCase('en').replaceAll('_', '-');
}

const statuses = [
  {
    fallback: '◇',
    icon: { android: 'bookmark_border', ios: 'bookmark' },
    label: 'wantToRead',
    value: 'want_to_read',
  },
  {
    fallback: '◫',
    icon: { android: 'menu_book', ios: 'book.pages' },
    label: 'readingNow',
    value: 'reading',
  },
  {
    fallback: '✓',
    icon: { android: 'check_circle', ios: 'checkmark.circle.fill' },
    label: 'finished',
    value: 'read',
  },
  {
    fallback: '⊘',
    icon: { android: 'block', ios: 'bookmark.slash' },
    label: 'didNotFinish',
    value: 'dnf',
  },
] as const satisfies readonly {
  fallback: string;
  icon: { android: string; ios: string };
  label: 'didNotFinish' | 'finished' | 'readingNow' | 'wantToRead';
  value: ReadingStatus;
}[];

function BookEditForm({ book }: { book: SavedBook }) {
  const { locale, t } = useI18n();
  const c = booksCopy(locale);
  const updateBook = useUpdateBookMutation();
  const editForm = useForm<{ author: string; title: string }>({
    defaultValues: { author: book.author, title: book.title },
  });
  const author = useWatch({ control: editForm.control, name: 'author' });
  const title = useWatch({ control: editForm.control, name: 'title' });

  return (
    <Surface variant="section">
      <AppText variant="heading">{c.editBook}</AppText>
      <Controller
        control={editForm.control}
        name="title"
        render={({ field: { onBlur, onChange, value } }) => (
          <TextField label={t('bookTitle')} onBlur={onBlur} onChangeText={onChange} value={value} />
        )}
      />
      <Controller
        control={editForm.control}
        name="author"
        render={({ field: { onBlur, onChange, value } }) => (
          <TextField label={t('author')} onBlur={onBlur} onChangeText={onChange} value={value} />
        )}
      />
      <Button
        disabled={!title.trim() || !author.trim()}
        loading={updateBook.isPending}
        onPress={() => updateBook.mutate({ author: author.trim(), bookId: book.bookId, title: title.trim() })}
      >
        {c.saveChanges}
      </Button>
      {updateBook.isError ? <Notice title={t('genericError')} tone="error" /> : null}
    </Surface>
  );
}

export function BookDetailScreen({
  bookId,
  debateAvailable,
  debatePending = false,
  onDeleted,
  onOpenDebates,
  onOpenPrivacy,
  onOpenQuestions,
  onOpenReading,
  onOpenReflection,
  onRetryWorkflow,
  workflowAvailable = true,
  workflowError = false,
  workflowPending = false,
}: {
  bookId: number;
  debateAvailable?: boolean;
  debatePending?: boolean;
  onDeleted(): void;
  onOpenDebates?(recommendation?: BookDebateRecommendation): void;
  onOpenPrivacy?(): void;
  onOpenQuestions?(): void;
  onOpenReading(): void;
  onOpenReflection?(): void;
  onRetryWorkflow?(): void;
  workflowAvailable?: boolean;
  workflowError?: boolean;
  workflowPending?: boolean;
}) {
  const canOpenDebate = debateAvailable ?? workflowAvailable;
  const { locale, t } = useI18n();
  const c = booksCopy(locale);
  const book = useBookQuery(bookId);
  const knowledge = useBookKnowledgeQuery(bookId);
  const regenerate = useRegenerateBookKnowledgeMutation(bookId);
  const updateShelf = useUpdateBookShelfMutation();
  const deleteBook = useDeleteBookMutation();
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [selectedDiscussionPointId, setSelectedDiscussionPointId] = useState<string>();

  if (book.isLoading) return <LoadingState label={t('bookDetails')} />;
  if (book.isError) {
    return (
      <Screen testID="book-detail-load-error">
        <Notice title={t('genericError')} tone="error">
          <Button onPress={() => void book.refetch()} variant="outline">
            {t('retry')}
          </Button>
        </Notice>
      </Screen>
    );
  }
  if (!book.data) {
    return (
      <Screen>
        <Notice title={t('bookNotFound')} tone="error" />
      </Screen>
    );
  }

  const selectedRecommendation = knowledge.data && selectedDiscussionPointId
    ? debateRecommendationForPoint(knowledge.data, selectedDiscussionPointId)
    : undefined;
  const knowledgeNotFound =
    knowledge.error instanceof ApiRequestError && knowledge.error.status === 404;
  const metadataRowsWithEmpty: (BookMetadataRow | null)[] = [
    book.data.publishedYear
      ? { label: c.publishedYear, value: String(book.data.publishedYear) }
      : null,
    book.data.publisher ? { label: c.publisher, value: book.data.publisher } : null,
    book.data.language ? { label: c.language, value: book.data.language } : null,
    book.data.isbn ? { label: c.isbn, value: book.data.isbn } : null,
  ];
  const metadataRows = metadataRowsWithEmpty.filter(
    (row): row is BookMetadataRow => row !== null,
  );

  return (
    <Screen layout="edge" testID="book-detail-screen">
      <CurrentBookSummary book={book.data} locale={locale} />

      {metadataRows.length > 0 ? (
        <Surface testID="book-metadata" variant="section">
          <AppText variant="eyebrow">{c.bibliographic}</AppText>
          {metadataRows.map((row) => (
            <View key={row.label} style={styles.metadataRow}>
              <AppText style={styles.metadataLabel} variant="caption">{row.label}</AppText>
              <AppText style={styles.metadataValue} variant="caption">{row.value}</AppText>
            </View>
          ))}
        </Surface>
      ) : null}

      <Surface variant="section">
        <AppText variant="heading">{t('readingStatus')}</AppText>
        <View accessibilityRole="radiogroup" style={styles.statusActions}>
          {statuses.map((status) => {
            const selected = book.data?.readingStatus === status.value;
            const loading =
              updateShelf.isPending && updateShelf.variables?.shelf.readingStatus === status.value;
            return (
              <Pressable
                accessibilityLabel={t(status.label)}
                accessibilityRole="radio"
                accessibilityState={{
                  busy: loading,
                  checked: selected,
                  disabled: updateShelf.isPending,
                }}
                disabled={updateShelf.isPending}
                key={status.value}
                onPress={() =>
                  updateShelf.mutate({ bookId, shelf: { readingStatus: status.value } })
                }
                style={({ pressed }) => [
                  styles.statusAction,
                  selected && styles.selectedStatusAction,
                  pressed && styles.pressedStatusAction,
                  updateShelf.isPending && styles.disabledStatusAction,
                ]}
                testID={`reading-status-${status.value}`}
              >
                {loading ? (
                  <ActivityIndicator color={colors.accentDeep} size="small" />
                ) : (
                  <SymbolView
                    fallback={<AppText style={styles.statusFallback}>{status.fallback}</AppText>}
                    name={status.icon}
                    size={23}
                    tintColor={selected ? colors.accentDeep : colors.muted}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </Surface>

      <Surface variant="section">
        <AppText variant="heading">{c.rating}</AppText>
        <BookRatingInput
          clearLabel={c.clearRating}
          disabled={updateShelf.isPending}
          label={c.rating}
          onChange={(rating) =>
            updateShelf.mutate({
              bookId,
              shelf: rating === undefined ? { clearRating: true } : { rating },
            })
          }
          rating={book.data.rating}
        />
      </Surface>

      <BookEditForm
        book={book.data}
        key={`${book.data.bookId}:${book.data.updatedAt ?? book.data.title}:${book.data.author}`}
      />

      <Surface variant="section">
        <AppText variant="heading">{t('readingWorkspace')}</AppText>
        <AppText>{t('readingWorkspaceDescription')}</AppText>
        <View style={styles.actions} testID="book-workflow-actions">
          {onOpenReflection ? (
            <Button
              disabled={!workflowAvailable}
              loading={workflowPending}
              onPress={onOpenReflection}
              testID="open-book-reflection"
              variant="primary"
            >
              {c.openReflection}
            </Button>
          ) : null}
          <Button onPress={onOpenReading} variant="outline">{t('continueReading')}</Button>
          {onOpenQuestions ? (
            <Button
              disabled={!workflowAvailable}
              loading={workflowPending}
              onPress={onOpenQuestions}
              testID="open-book-questions"
              variant="outline"
            >
              {c.openQuestions}
            </Button>
          ) : null}
          {onOpenDebates ? (
            <Button
              disabled={!canOpenDebate}
              loading={debatePending}
              onPress={() => onOpenDebates(selectedRecommendation)}
              testID="open-book-debates"
              variant="outline"
            >
              {c.debate}
            </Button>
          ) : null}
        </View>
        {workflowError ? (
          <Notice title={t('genericError')} tone="error">
            {onRetryWorkflow ? (
              <Button onPress={onRetryWorkflow} testID="book-workflow-retry" variant="outline">
                {t('retry')}
              </Button>
            ) : null}
          </Notice>
        ) : !workflowPending && !workflowAvailable ? (
          <Notice title={c.workflowUnavailable} />
        ) : null}
      </Surface>

      {onOpenPrivacy ? <AiProcessingNotice onOpenPrivacy={onOpenPrivacy} /> : null}

      <Surface variant="section">
        <AppText variant="heading">{t('knowledge')}</AppText>
        {knowledge.data && !knowledgeNotFound ? (
          <>
            <AppText testID="book-knowledge-version" variant="caption">
              {c.knowledgeVersion}: {knowledge.data.version}
            </AppText>
            {knowledge.data.stale ? (
              <Notice title={c.knowledgeStale} />
            ) : null}
            {knowledge.data.fallbackUsed ? (
              <Notice title={c.knowledgeFallback} />
            ) : null}
            {knowledge.data.refreshPending ? (
              <Notice title={c.knowledgeRefreshPending} />
            ) : null}
            {knowledge.data.summary ? <AppText>{knowledge.data.summary}</AppText> : null}
            {knowledge.data.themes.length ? (
              <View style={styles.section}>
                <AppText variant="label">{t('themes')}</AppText>
                {knowledge.data.themes.map((theme) => (
                  <AppText key={theme}>• {theme}</AppText>
                ))}
              </View>
            ) : null}
            {knowledge.data.discussionPoints.length ? (
              <View style={styles.section}>
                <AppText variant="label">{t('discussionPoints')}</AppText>
                {knowledge.data.discussionPoints.map((point) => (
                  <Button
                    accessibilityState={{ selected: selectedDiscussionPointId === point.id }}
                    key={point.id}
                    onPress={() => setSelectedDiscussionPointId(point.id)}
                    testID={`book-knowledge-topic-${point.id}`}
                    variant={selectedDiscussionPointId === point.id ? 'primary' : 'outline'}
                  >
                    {point.question}
                  </Button>
                ))}
                {selectedRecommendation?.personaKeys.length ? (
                  <AppText testID="book-knowledge-recommended-personas" variant="caption">
                    {selectedRecommendation.personaKeys.join(', ')}
                  </AppText>
                ) : null}
              </View>
            ) : null}
            {knowledge.isError ? (
              <Notice title={t('genericError')} tone="error">
                <Button onPress={() => void knowledge.refetch()} variant="outline">
                  {t('retry')}
                </Button>
              </Notice>
            ) : null}
          </>
        ) : knowledge.isLoading ? (
          <LoadingState label={t('knowledge')} />
        ) : knowledge.isError && !knowledgeNotFound ? (
          <Notice title={t('genericError')} tone="error">
            <Button onPress={() => void knowledge.refetch()} variant="outline">
              {t('retry')}
            </Button>
          </Notice>
        ) : (
          <Notice title={t('knowledgeUnavailable')}>
            <Button
              loading={regenerate.isPending}
              onPress={() => regenerate.mutate()}
              variant="outline"
            >
              {t('regenerateKnowledge')}
            </Button>
          </Notice>
        )}
      </Surface>

      {updateShelf.isError || deleteBook.isError || regenerate.isError ? (
        <Notice title={t('genericError')} tone="error" />
      ) : null}
      <Surface variant="section">
        <Button
          loading={deleteBook.isPending}
          onPress={() => setDeleteConfirmationOpen(true)}
          variant="destructive"
        >
          {t('deleteBook')}
        </Button>
      </Surface>
      <ConfirmActionDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('remove')}
        description={t('deleteBookConfirm')}
        error={deleteBook.isError ? t('genericError') : undefined}
        onCancel={() => setDeleteConfirmationOpen(false)}
        onConfirm={async () => {
          await deleteBook.mutateAsync(bookId);
          onDeleted();
        }}
        open={deleteConfirmationOpen}
        title={t('deleteBook')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.x2,
  },
  section: {
    gap: spacing.x2,
  },
  disabledStatusAction: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
  },
  metadataLabel: {
    color: colors.muted,
  },
  metadataRow: {
    alignItems: 'baseline',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.x3,
    justifyContent: 'space-between',
    paddingVertical: spacing.x2,
  },
  metadataValue: {
    color: colors.ink,
    flex: 1,
    textAlign: 'right',
  },
  pressedStatusAction: {
    opacity: 0.62,
  },
  selectedStatusAction: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 2,
  },
  statusAction: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.x2,
  },
  statusFallback: {
    color: colors.muted,
    fontSize: 22,
    lineHeight: 25,
  },
});
