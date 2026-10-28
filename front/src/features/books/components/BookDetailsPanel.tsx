import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { testAttr } from '@/utils/testAttrs';

import {
  useBookQuery,
  useBookKnowledgeQuery,
  useBookBackgroundQuery,
  useDeleteBookMutation,
  useRegenerateBookKnowledgeMutation,
  useUpdateBookMutation,
  useUpdateBookShelfMutation,
} from '../queries';
import { bookPath } from '../routes';
import type { BookInfoDraft, BookInfoSectionProps } from '../panel-types';
import { useBookSelectionStore } from '../selection-store';
import type { BookReadingStatus } from '../types';
import { BookHeader } from './BookHeader';
import { BookKnowledgeStatus } from './BookKnowledgeStatus';
import { LibraryRevisionList, LibraryThreadProgress } from './LibraryThreadSummary';
import { BookRatingInput } from './BookRatingInput';
import { BookStatusSelect } from './BookStatusSelect';

export function BookDetailsPanel({ bookId }: { bookId: number }) {
  return <BookDetails key={bookId} bookId={bookId} />;
}

function BookDetails({ bookId }: { bookId: number }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const bookQuery = useBookQuery(bookId);
  const knowledgeQuery = useBookKnowledgeQuery(bookId);
  const backgroundQuery = useBookBackgroundQuery(bookId);
  const regenerateKnowledge = useRegenerateBookKnowledgeMutation(bookId);
  const updateBook = useUpdateBookMutation();
  const updateShelf = useUpdateBookShelfMutation();
  const deleteBook = useDeleteBookMutation();
  const selectBook = useBookSelectionStore((state) => state.selectBook);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const book = bookQuery.data;
  const selectedBookId = book?.bookId;
  const pending = updateBook.isPending || updateShelf.isPending || deleteBook.isPending;

  useEffect(() => {
    if (selectedBookId) selectBook(selectedBookId);
  }, [selectedBookId, selectBook]);

  return (
    <>
      {book && <BookHeader book={book} />}
      <section className="web-book-detail-page grid gap-5" {...testAttr('book-detail-page')}>
        <BookInfoSection
          key={bookId}
          book={book}
          pending={pending}
          onSave={(title, author, onSuccess) =>
            updateBook.mutate({ bookId, title, author }, { onSuccess })
          }
          onShelfChange={(shelf) => updateShelf.mutate({ bookId, shelf })}
          onDelete={() => setDeleteOpen(true)}
          onReview={() => navigate(bookPath('review-editor', { bookId }))}
        />
        <BookKnowledgeStatus
          background={backgroundQuery.data}
          backgroundError={backgroundQuery.isError}
          backgroundPending={backgroundQuery.isPending}
          onEdit={book ? () => navigate(`/book/${bookId}/knowledge/edit`) : undefined}
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
        title={t('delete')}
        onConfirm={() =>
          deleteBook.mutateAsync(bookId, {
            onSuccess: () => {
              if (!isCurrentSession()) return;
              selectBook(undefined);
              navigate(bookPath('book-list'));
            },
          })
        }
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </>
  );
}

function BookInfoSection({
  book,
  pending,
  onSave,
  onShelfChange,
  onDelete,
  onReview,
}: BookInfoSectionProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<BookInfoDraft>();
  const title = draft?.title ?? book?.title ?? '';
  const author = draft?.author ?? book?.author ?? '';
  const status: BookReadingStatus =
    book?.readingStatus === 'reading' ||
    book?.readingStatus === 'read' ||
    book?.readingStatus === 'dnf'
      ? book.readingStatus
      : 'want_to_read';
  const statusLabel = (status: BookReadingStatus) =>
    ({
      want_to_read: t('shelfStatusWantToRead'),
      reading: t('shelfStatusReading'),
      read: t('shelfStatusRead'),
      dnf: t('shelfStatusDnf'),
    })[status];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !author.trim() || pending) return;
    onSave(title.trim(), author.trim(), () => setDraft(undefined));
  }

  return (
    <div className="web-book-detail-editor rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_18px_50px_rgba(23,23,23,0.06)] sm:p-5">
      <h2 className="font-display text-3xl font-semibold tracking-normal">{t('bookDetail')}</h2>
      {book ? (
        <>
          {book.loop && (
            <div className="web-book-thread-grid mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
              <LibraryThreadProgress loop={book.loop} />
              <LibraryRevisionList revisions={book.recentRevisions ?? []} />
            </div>
          )}
          <form
            className="web-book-detail-form mt-4 grid gap-3"
            onSubmit={submit}
            {...testAttr('book-edit-form')}
          >
            <div className="web-book-shelf-controls grid gap-3 rounded border border-stone-200 bg-white p-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-stone-600">{t('shelfStatusLabel')}</span>
                <BookStatusSelect
                  disabled={pending}
                  id="book-detail-status"
                  name="readingStatus"
                  onChange={(readingStatus) => onShelfChange({ readingStatus })}
                  status={status}
                  statusLabel={statusLabel}
                  testId="book-detail-status"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-stone-600">{t('shelfRatingLabel')}</span>
                <BookRatingInput
                  disabled={pending}
                  onChange={(rating) =>
                    onShelfChange(rating === undefined ? { clearRating: true } : { rating })
                  }
                  rating={book.rating}
                  testId="book-detail-rating"
                />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="text-stone-600">{t('bookTitleLabel')}</span>
              <Input
                disabled={pending}
                onChange={(event) => setDraft({ title: event.target.value, author })}
                value={title}
                {...testAttr('book-edit-title-input')}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-stone-600">{t('bookAuthorLabel')}</span>
              <Input
                disabled={pending}
                onChange={(event) => setDraft({ title, author: event.target.value })}
                value={author}
                {...testAttr('book-edit-author-input')}
              />
            </label>
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
                onClick={onDelete}
                type="button"
                {...testAttr('book-detail-delete')}
              >
                {t('delete')}
              </Button>
              <Button
                disabled={pending}
                onClick={onReview}
                type="button"
                {...testAttr('book-start-review')}
              >
                {t('startReview')}
              </Button>
            </div>
          </form>
        </>
      ) : (
        <div className="mt-4 text-sm text-stone-500">{t('bookDetailEmpty')}</div>
      )}
    </div>
  );
}
