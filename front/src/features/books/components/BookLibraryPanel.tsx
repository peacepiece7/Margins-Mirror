import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { useI18n } from '@/lib/i18n';
import { bookKeys } from '@/lib/query-keys';
import type { SaveBookResponse } from '@/types/api/book';

import { useBooksQuery, useDeleteBookMutation, useUpdateBookShelfMutation } from '../queries';
import { useBookSelectionStore } from '../selection-store';
import { BookListPage } from './BookListPage';
import { BookHeader } from './BookHeader';

export function BookLibraryPanel() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<SaveBookResponse>();
  const filter = useBookSelectionStore((state) => state.shelfFilter);
  const sort = useBookSelectionStore((state) => state.shelfSort);
  const setFilter = useBookSelectionStore((state) => state.setShelfFilter);
  const setSort = useBookSelectionStore((state) => state.setShelfSort);
  const query = {
    status: filter === 'all' ? undefined : filter,
    sort,
  };
  const books = useBooksQuery(query);
  const updateShelf = useUpdateBookShelfMutation();
  const deleteBook = useDeleteBookMutation();
  const selectedBookId = useBookSelectionStore((state) => state.selectedBookId);
  const selectBook = useBookSelectionStore((state) => state.selectBook);
  const selectedBook =
    books.data?.books.find((book) => book.bookId === selectedBookId) ?? books.data?.books[0];

  return (
    <>
      {selectedBook && <BookHeader book={selectedBook} />}
      <BookListPage
        books={books.data?.books ?? []}
        filter={filter}
        loading={books.isFetching || updateShelf.isPending || deleteBook.isPending}
        sort={sort}
        onDelete={setPendingDelete}
        onFilterChange={(nextFilter) => {
          void queryClient.invalidateQueries({
            exact: true,
            queryKey: bookKeys.list({
              status: nextFilter === 'all' ? undefined : nextFilter,
              sort,
            }),
          });
          setFilter(nextFilter);
        }}
        onRatingChange={(bookId, rating) =>
          updateShelf.mutate({
            bookId,
            shelf: rating === undefined ? { clearRating: true } : { rating },
          })
        }
        onSelect={(book) => selectBook(book.bookId)}
        onSortChange={(nextSort) => {
          void queryClient.invalidateQueries({
            exact: true,
            queryKey: bookKeys.list({
              status: filter === 'all' ? undefined : filter,
              sort: nextSort,
            }),
          });
          setSort(nextSort);
        }}
        onStatusChange={(bookId, readingStatus) =>
          updateShelf.mutate({ bookId, shelf: { readingStatus } })
        }
      />
      <ConfirmActionDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        description={pendingDelete ? t('deleteConfirm') : ''}
        loadingLabel={t('editorLoading')}
        onConfirm={() => {
          if (pendingDelete) {
            deleteBook.mutate(pendingDelete.bookId);
            if (selectedBookId === pendingDelete.bookId) selectBook(undefined);
          }
          setPendingDelete(undefined);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(undefined);
        }}
        open={Boolean(pendingDelete)}
        title={t('delete')}
      />
    </>
  );
}
