import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { BookRatingInput } from '@/features/books/components/BookRatingInput';
import { BookStatusSelect } from '@/features/books/components/BookStatusSelect';
import { bookPath } from '@/features/books/routes';
import type {
  BookReadingStatus,
  BookShelfSort,
  BookShelfStatusFilter,
} from '@/features/books/types';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { BookListPageProps } from '../panel-types';

function normalizeStatus(status?: string): BookReadingStatus {
  return status === 'reading' || status === 'read' || status === 'dnf' ? status : 'want_to_read';
}

export function BookListPage({
  books,
  filter,
  loading,
  sort,
  onDelete,
  onFilterChange,
  onRatingChange,
  onSelect,
  onSortChange,
  onStatusChange,
}: BookListPageProps) {
  const { t } = useI18n();
  const statusLabel = (status: BookReadingStatus) =>
    ({
      want_to_read: t('shelfStatusWantToRead'),
      reading: t('shelfStatusReading'),
      read: t('shelfStatusRead'),
      dnf: t('shelfStatusDnf'),
    })[status];

  return (
    <section className="grid gap-3" {...testAttr('book-list-page')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold tracking-normal">{t('bookList')}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-stone-600">{t('shelfFilterLabel')}</span>
            <NativeSelect
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => onFilterChange(event.target.value as BookShelfStatusFilter)}
              value={filter}
              {...testAttr('book-shelf-filter')}
            >
              <option value="all">{t('shelfFilterAll')}</option>
              <option value="want_to_read">{t('shelfStatusWantToRead')}</option>
              <option value="reading">{t('shelfStatusReading')}</option>
              <option value="read">{t('shelfStatusRead')}</option>
              <option value="dnf">{t('shelfStatusDnf')}</option>
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-stone-600">{t('shelfSortLabel')}</span>
            <NativeSelect
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => onSortChange(event.target.value as BookShelfSort)}
              value={sort}
              {...testAttr('book-shelf-sort')}
            >
              <option value="recent">{t('shelfSortRecent')}</option>
              <option value="title_asc">{t('shelfSortTitleAsc')}</option>
              <option value="title_desc">{t('shelfSortTitleDesc')}</option>
              <option value="rating_desc">{t('shelfSortRatingDesc')}</option>
              <option value="rating_asc">{t('shelfSortRatingAsc')}</option>
              <option value="status">{t('shelfSortStatus')}</option>
            </NativeSelect>
          </label>
        </div>
      </div>
      {books.map((book) => (
        <article
          className="flex flex-col gap-3 rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_12px_36px_rgba(23,23,23,0.05)] lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          key={book.bookId}
          {...testAttr('saved-book-row')}
        >
          <div className="grid min-w-0 items-center gap-3 sm:grid-cols-[56px_minmax(0,1fr)]">
            {book.coverImageUrl ? (
              <img
                alt=""
                className="h-20 w-14 rounded border border-stone-200 bg-white object-cover"
                src={book.coverImageUrl}
                {...testAttr('saved-book-cover')}
              />
            ) : (
              <div
                aria-hidden="true"
                className="h-20 w-14 rounded border border-stone-200 bg-stone-100"
              />
            )}
            <div className="flex min-h-20 min-w-0 flex-col justify-center">
              <Link
                className="inline rounded-sm text-lg font-semibold text-inherit no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => onSelect(book)}
                to={bookPath('book-detail', { bookId: book.bookId })}
                {...testAttr('saved-book-detail-link')}
              >
                {book.title}
              </Link>
              {book.subtitle && <div className="text-sm text-stone-500">{book.subtitle}</div>}
              <div className="text-sm text-stone-600">{book.author}</div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-stone-500">
                <span {...testAttr('saved-book-status-badge')}>
                  {statusLabel(normalizeStatus(book.readingStatus))}
                </span>
                {book.rating !== undefined && (
                  <span
                    className="text-[var(--margins-gold)]"
                    {...testAttr('saved-book-rating-badge')}
                  >
                    ★ {book.rating}
                  </span>
                )}
                {book.publisher && <span>{book.publisher}</span>}
                {book.publishedYear && <span>{book.publishedYear}</span>}
                {book.isbn && <span>ISBN {book.isbn}</span>}
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <span className="text-xs text-stone-500">{t('shelfStatusLabel')}</span>
              <BookStatusSelect
                disabled={loading}
                onChange={(status) => onStatusChange(book.bookId, status)}
                status={normalizeStatus(book.readingStatus)}
                statusLabel={statusLabel}
                testId={`saved-book-status-${book.bookId}`}
              />
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-stone-500">{t('shelfRatingLabel')}</span>
              <BookRatingInput
                disabled={loading}
                onChange={(rating) => onRatingChange(book.bookId, rating)}
                rating={book.rating}
                testId={`saved-book-rating-${book.bookId}`}
              />
            </div>
            <div className="flex gap-2">
              <Button asChild className="rounded border border-stone-300 px-3 py-2 text-sm">
                <Link
                  onClick={() => onSelect(book)}
                  to={bookPath('book-detail', { bookId: book.bookId })}
                  {...testAttr('saved-book-edit-open')}
                >
                  {t('edit')}
                </Link>
              </Button>
              <Button
                className="rounded border border-red-300 px-3 py-2 text-sm text-red-700"
                disabled={loading}
                onClick={() => onDelete(book)}
                type="button"
                {...testAttr('saved-book-delete')}
              >
                {t('delete')}
              </Button>
            </div>
          </div>
        </article>
      ))}
      {!books.length && (
        <div className="rounded border border-stone-300 bg-stone-50/95 p-8 text-center text-sm text-stone-500">
          {t('noSavedBooks')}
        </div>
      )}
    </section>
  );
}
