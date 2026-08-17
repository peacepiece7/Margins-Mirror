import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { AiProcessingNotice } from '@/components/ui/ai-processing-notice';
import { useFlashAlert } from '@/components/ui/flash-alert';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n } from '@/lib/i18n';
import {
  QUESTION_AI_NOTICE_DISMISS_DAYS,
  QUESTION_AI_NOTICE_COOKIE_KEY,
} from '@/lib/dismissible-notice';
import type { BookCandidate } from '@/types/api/book';

import {
  useBookSearchCommand,
  useBookSearchInfiniteQuery,
  useSaveBookMutation,
  useSaveManualBookMutation,
} from '../queries';
import { bookPath } from '../routes';
import { useBookSelectionStore } from '../selection-store';
import { BookSearchPage } from './BookSearchPage';

const candidateLimit = 5;

export function BookSearchPanel() {
  const { t } = useI18n();
  const { show: showFlashAlert } = useFlashAlert();
  const navigate = useNavigate();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const command = useBookSearchCommand();
  const loadMoreElement = useRef<HTMLDivElement | null>(null);
  const search = useBookSearchInfiniteQuery(command.query, candidateLimit, Boolean(command.query));
  const saveBook = useSaveBookMutation();
  const saveManualBook = useSaveManualBookMutation();
  const selectBook = useBookSelectionStore((state) => state.selectBook);
  const saving = saveBook.isPending || saveManualBook.isPending;
  const candidates = useMemo(
    () => search.data?.pages.flatMap((result) => result.candidates) ?? [],
    [search.data],
  );
  const lastSearchPage = search.data?.pages.at(-1);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = search;
  const setLoadMoreRef = useCallback((node: HTMLDivElement | null) => {
    loadMoreElement.current = node;
  }, []);

  useEffect(() => {
    const target = loadMoreElement.current;
    if (!target || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextPage();
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  function handleSaveSuccess(bookId: number) {
    if (!isCurrentSession()) return;
    showFlashAlert({ message: t('bookAdded'), variant: 'success' });
    selectBook(bookId);
    navigate(bookPath('book-list'));
  }

  function handleSaveError(error: unknown) {
    if (!isCurrentSession()) return;
    showFlashAlert({ message: apiErrorMessage(error, t), variant: 'destructive' });
  }

  function saveCandidate(candidate: BookCandidate) {
    saveBook.mutate(candidate, {
      onSuccess: (book) => handleSaveSuccess(book.bookId),
      onError: handleSaveError,
    });
  }

  return (
    <div className="grid gap-3">
      <AiProcessingNotice
        action={t('aiActionBookSearch')}
        dismissDays={QUESTION_AI_NOTICE_DISMISS_DAYS}
        storageKey={QUESTION_AI_NOTICE_COOKIE_KEY}
      />
      <BookSearchPage
        candidateHasMore={Boolean(hasNextPage)}
        candidateTotalItems={lastSearchPage?.totalItems}
        candidates={candidates}
        error={search.isError}
        loadMoreRef={setLoadMoreRef}
        loading={search.isLoading}
        loadingMore={isFetchingNextPage}
        onClear={command.clear}
        onManualSubmit={async ({ title, author }) => {
          try {
            const book = await saveManualBook.mutateAsync({ title, author });
            if (!isCurrentSession()) return;
            handleSaveSuccess(book.bookId);
          } catch (error) {
            if (!isCurrentSession()) return;
            handleSaveError(error);
          }
        }}
        onRetry={() => void search.refetch()}
        onSaveCandidate={saveCandidate}
        onSearch={command.commit}
        query={command.query}
        saving={saving}
      />
    </div>
  );
}
