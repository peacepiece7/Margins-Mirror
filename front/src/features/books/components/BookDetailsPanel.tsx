import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import {
  useBookQuery,
  useBookKnowledgeQuery,
  useDeleteBookMutation,
  useRegenerateBookKnowledgeMutation,
  useUpdateBookMutation,
  useUpdateBookShelfMutation,
} from '../queries';
import { bookPath } from '../routes';
import { useBookSelectionStore } from '../selection-store';
import type { BookReadingStatus } from '../types';
import { BookHeader } from './BookHeader';
import { BookKnowledgeStatus } from './BookKnowledgeStatus';
import { BookRatingInput } from './BookRatingInput';
import { BookStatusSelect } from './BookStatusSelect';

function normalizeStatus(status?: string): BookReadingStatus {
  return status === 'reading' || status === 'read' || status === 'dnf' ? status : 'want_to_read';
}

export function BookDetailsPanel({ bookId }: { bookId: number }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const bookQuery = useBookQuery(bookId);
  const knowledgeQuery = useBookKnowledgeQuery(bookId);
  const regenerateKnowledge = useRegenerateBookKnowledgeMutation(bookId);
  const updateBook = useUpdateBookMutation();
  const updateShelf = useUpdateBookShelfMutation();
  const deleteBook = useDeleteBookMutation();
  const selectBook = useBookSelectionStore((state) => state.selectBook);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const book = bookQuery.data;
  const pending = updateBook.isPending || updateShelf.isPending || deleteBook.isPending;

  useEffect(() => {
    if (!book) return;
    selectBook(book.bookId);
    setTitle(book.title);
    setAuthor(book.author ?? '');
  }, [book, selectBook]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!book || !title.trim() || !author.trim() || pending) return;
    updateBook.mutate({ bookId, title: title.trim(), author: author.trim() });
  }

  const statusLabel = (status: BookReadingStatus) =>
    ({
      want_to_read: t('shelfStatusWantToRead'),
      reading: t('shelfStatusReading'),
      read: t('shelfStatusRead'),
      dnf: t('shelfStatusDnf'),
    })[status];

  return (
    <>
      {book && <BookHeader book={book} />}
      <section className="grid gap-5" {...testAttr('book-detail-page')}>
        <div className="rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_18px_50px_rgba(23,23,23,0.06)] sm:p-5">
          <h2 className="font-display text-3xl font-semibold tracking-normal">{t('bookDetail')}</h2>
          {book ? (
            <form className="mt-4 grid gap-3" onSubmit={submit} {...testAttr('book-edit-form')}>
              <div className="grid gap-3 rounded border border-stone-200 bg-white p-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-stone-600">{t('shelfStatusLabel')}</span>
                  <BookStatusSelect
                    disabled={pending}
                    onChange={(readingStatus) =>
                      updateShelf.mutate({ bookId, shelf: { readingStatus } })
                    }
                    status={normalizeStatus(book.readingStatus)}
                    statusLabel={statusLabel}
                    testId="book-detail-status"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-stone-600">{t('shelfRatingLabel')}</span>
                  <BookRatingInput
                    disabled={pending}
                    onChange={(rating) =>
                      updateShelf.mutate({
                        bookId,
                        shelf: rating === undefined ? { clearRating: true } : { rating },
                      })
                    }
                    rating={book.rating}
                    testId="book-detail-rating"
                  />
                </label>
              </div>
              <Input
                onChange={(event) => setTitle(event.target.value)}
                value={title}
                {...testAttr('book-edit-title-input')}
              />
              <Input
                onChange={(event) => setAuthor(event.target.value)}
                value={author}
                {...testAttr('book-edit-author-input')}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending || !title.trim() || !author.trim()}
                  type="submit"
                  {...testAttr('book-edit-submit')}
                >
                  {t('saveEdit')}
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => setDeleteOpen(true)}
                  type="button"
                  {...testAttr('book-detail-delete')}
                >
                  {t('delete')}
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => navigate(bookPath('review-editor', { bookId }))}
                  type="button"
                  {...testAttr('book-start-review')}
                >
                  {t('startReview')}
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-4 text-sm text-stone-500">{t('bookDetailEmpty')}</div>
          )}
        </div>
        <BookKnowledgeStatus
          error={knowledgeQuery.isError || regenerateKnowledge.isError}
          knowledge={knowledgeQuery.data}
          onRefresh={() => regenerateKnowledge.mutate()}
          pending={knowledgeQuery.isPending}
          refreshing={regenerateKnowledge.isPending}
        />
      </section>
      <ConfirmActionDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        description={t('deleteConfirm')}
        loadingLabel={t('editorLoading')}
        onConfirm={() =>
          deleteBook.mutate(bookId, {
            onSuccess: () => {
              selectBook(undefined);
              navigate(bookPath('book-list'));
            },
          })
        }
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title={t('delete')}
      />
    </>
  );
}
