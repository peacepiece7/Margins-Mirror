import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Button } from '@/components/ui/button';
import { SpinnerInline } from '@/components/ui/spinner';
import { bookPath } from '@/features/books/routes';
import { bookKeys } from '@/lib/query-keys';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import type { LibraryLoopStage, SaveBookResponse } from '@/types/api/book';
import { testAttr } from '@/utils/testAttrs';

import { useBooksQuery, useDeleteBookMutation, useUpdateBookShelfMutation } from '../queries';
import { useBookSelectionStore } from '../selection-store';
import type { BookShelfStatusFilter } from '../types';
import { useBookPagination } from '../use-book-pagination';
import { BookListPage } from './BookListPage';
import { LibraryActivityList } from './LibraryThreadSummary';

const shelfFilters: Array<{ id: BookShelfStatusFilter; label: TranslationKey }> = [
  { id: 'all', label: 'shelfFilterAll' },
  { id: 'want_to_read', label: 'shelfStatusWantToRead' },
  { id: 'reading', label: 'shelfStatusReading' },
  { id: 'read', label: 'shelfStatusRead' },
  { id: 'dnf', label: 'shelfStatusDnf' },
];

const loopStages: Array<{ id: LibraryLoopStage; label: TranslationKey }> = [
  { id: 'REFLECT', label: 'reflectionStepReflect' },
  { id: 'INTERVIEW', label: 'reflectionStepInterview' },
  { id: 'GUIDE', label: 'reflectionStepGuide' },
  { id: 'DISCUSS', label: 'reflectionStepDiscuss' },
  { id: 'REFINE', label: 'reflectionStepRefine' },
];

export function BookLibraryPanel() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<SaveBookResponse>();
  const [stageFilter, setStageFilter] = useState<LibraryLoopStage>();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const filter = useBookSelectionStore((state) => state.shelfFilter);
  const sort = useBookSelectionStore((state) => state.shelfSort);
  const setFilter = useBookSelectionStore((state) => state.setShelfFilter);
  const setSort = useBookSelectionStore((state) => state.setShelfSort);
  const books = useBooksQuery({
    status: filter === 'all' ? undefined : filter,
    stage: stageFilter,
    sort,
  });
  const updateShelf = useUpdateBookShelfMutation();
  const deleteBook = useDeleteBookMutation();
  const selectBook = useBookSelectionStore((state) => state.selectBook);
  const pages = books.data?.pages;
  const visibleBooks = useMemo(
    () => [
      ...new Map(
        (pages?.flatMap((page) => page.books) ?? []).map((book) => [book.bookId, book]),
      ).values(),
    ],
    [pages],
  );
  const summary = pages?.[0]?.summary;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = books;
  const loadMore = useBookPagination(books);

  return (
    <section className="web-library-shell" {...testAttr('library-shell')}>
      <aside className="web-library-index" {...testAttr('library-shelf-index')}>
        <div className="web-library-index-heading">
          <span className="blueprint-unit-label">LIBRARY</span>
          <h2>{t('libraryShelfTitle')}</h2>
        </div>
        <nav aria-label={t('shelfFilterLabel')} className="web-library-filter-list">
          {shelfFilters.map((option) => {
            const count = summary?.shelfCounts[option.id] ?? 0;
            return (
              <Button
                aria-current={filter === option.id ? 'page' : undefined}
                className={`rounded-none ${filter === option.id ? 'is-active' : ''}`}
                key={option.id}
                onClick={() => setFilter(option.id)}
                type="button"
                variant="ghost"
                {...testAttr(`book-shelf-filter-${option.id}`)}
              >
                <span>{t(option.label)}</span>
                <small>{count}</small>
              </Button>
            );
          })}
        </nav>
        <div className="web-library-stage-filter">
          <h3>{t('libraryLoopStages')}</h3>
          {loopStages.map((stage) => {
            const count = summary?.stageCounts[stage.id] ?? 0;
            return (
              <Button
                aria-pressed={stageFilter === stage.id}
                className={`rounded-none ${stageFilter === stage.id ? 'is-active' : ''}`}
                key={stage.id}
                onClick={() =>
                  setStageFilter((current) => (current === stage.id ? undefined : stage.id))
                }
                type="button"
                variant="ghost"
              >
                <span>{t(stage.label)}</span>
                <small>{count}</small>
              </Button>
            );
          })}
        </div>
        <div className="web-library-index-actions">
          <Link to={bookPath('book-search')}>＋ {t('pageBookSearch')}</Link>
          <Link to={bookPath('public-reviews')}>{t('pagePublicReviews')} →</Link>
        </div>
      </aside>

      <div className="web-library-main">
        {books.isPending && (
          <div className="web-library-loading" {...testAttr('book-list-loading')}>
            <SpinnerInline>{t('libraryLoading')}</SpinnerInline>
          </div>
        )}
        {books.isError && (
          <Alert variant="destructive" {...testAttr('book-list-error')}>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{t('libraryLoadError')}</span>
              <Button
                onClick={() => {
                  void books.refetch();
                }}
                type="button"
                variant="outline"
              >
                {t('libraryRetry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!books.isPending && !books.isError && (
          <>
            <BookListPage
              books={visibleBooks}
              loading={books.isFetching || updateShelf.isPending || deleteBook.isPending}
              sort={sort}
              onDelete={(book) => {
                deleteBook.reset();
                setPendingDelete(book);
              }}
              onRatingChange={(bookId, rating) =>
                updateShelf.mutate({
                  bookId,
                  shelf: rating === undefined ? { clearRating: true } : { rating },
                })
              }
              onSelect={(book) => {
                queryClient.setQueryData(bookKeys.detail(book.bookId), book);
                selectBook(book.bookId);
              }}
              onSortChange={setSort}
              onStatusChange={(bookId, readingStatus) =>
                updateShelf.mutate({ bookId, shelf: { readingStatus } })
              }
            />
            {hasNextPage && (
              <div className="mt-4" ref={loadMore}>
                <Button
                  disabled={isFetchingNextPage}
                  loading={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                  type="button"
                  variant="outline"
                  {...testAttr('library-load-more')}
                >
                  {t('libraryMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <aside className="web-library-selected" {...testAttr('library-activity-rail')}>
        <span className="blueprint-unit-label">REVISION LOG</span>
        <div className="web-library-selected-book">
          <h2>{t('libraryActivityTitle')}</h2>
          <p>{t('libraryActivityDescription')}</p>
        </div>
        <LibraryActivityList activities={summary?.recentActivity ?? []} />
      </aside>

      <ConfirmActionDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        description={deleteBook.isError ? apiErrorMessage(deleteBook.error, t) : t('deleteConfirm')}
        loadingLabel={t('editorLoading')}
        onConfirm={() =>
          pendingDelete &&
          deleteBook.mutateAsync(pendingDelete.bookId, {
            onSuccess: (bookId) => {
              if (isCurrentSession() && useBookSelectionStore.getState().selectedBookId === bookId)
                selectBook(undefined);
            },
          })
        }
        onOpenChange={(open) => {
          if (!open) setPendingDelete(undefined);
        }}
        open={Boolean(pendingDelete)}
        title={t('delete')}
      />
    </section>
  );
}
