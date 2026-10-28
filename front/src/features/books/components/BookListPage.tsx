import { useId } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDownIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { BookRatingInput } from '@/features/books/components/BookRatingInput';
import { BookStatusSelect } from '@/features/books/components/BookStatusSelect';
import { bookPath } from '@/features/books/routes';
import type { BookReadingStatus, BookShelfSort } from '@/features/books/types';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { BookListPageProps } from '../panel-types';
import { LibraryThreadProgress } from './LibraryThreadSummary';

function normalizeStatus(status?: string): BookReadingStatus {
  return status === 'reading' || status === 'read' || status === 'dnf' ? status : 'want_to_read';
}

export function BookListPage({
  books,
  loading,
  sort,
  onDelete,
  onRatingChange,
  onSelect,
  onSortChange,
  onStatusChange,
}: BookListPageProps) {
  const { locale, t } = useI18n();
  const instanceId = useId();
  const statusLabel = (status: BookReadingStatus) =>
    ({
      want_to_read: t('shelfStatusWantToRead'),
      reading: t('shelfStatusReading'),
      read: t('shelfStatusRead'),
      dnf: t('shelfStatusDnf'),
    })[status];

  return (
    <section
      className="web-library-page grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3"
      {...testAttr('book-list-page')}
    >
      <div className="web-library-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="blueprint-unit-label">THREAD LIBRARY</span>
          <h1 className="font-display text-3xl font-semibold tracking-normal">{t('bookList')}</h1>
        </div>
        <label className="web-library-sort grid gap-1 text-sm">
          <span className="text-stone-600">{t('shelfSortLabel')}</span>
          <div className="relative w-full">
            <NativeSelect
              className="appearance-none pr-10"
              id={`book-shelf-sort-${instanceId}`}
              name="book-shelf-sort"
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
            <ChevronDownIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </label>
      </div>
      {books.map((book) => (
        <article
          className="web-library-row grid gap-3 rounded border border-stone-300 bg-stone-50/95 p-4"
          key={book.bookId}
          {...testAttr('saved-book-row')}
        >
          <div className="web-library-book grid min-w-0 items-center gap-3 sm:grid-cols-[48px_minmax(0,1fr)]">
            {book.coverImageUrl ? (
              <img
                alt=""
                className="h-16 w-12 rounded border border-stone-200 bg-white object-cover"
                data-ui="book-transition-cover"
                src={book.coverImageUrl}
                {...testAttr('saved-book-cover')}
              />
            ) : (
              <div
                aria-hidden="true"
                className="web-book-cover-placeholder h-16 w-12 rounded border border-stone-200 bg-stone-100"
                data-ui="book-transition-cover"
              />
            )}
            <div className="flex min-h-16 min-w-0 flex-col justify-center">
              <NavLink
                className="book-detail-transition-link inline rounded-sm text-lg font-semibold text-inherit no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => onSelect(book)}
                to={bookPath('book-detail', { bookId: book.bookId })}
                viewTransition
                {...testAttr('saved-book-detail-link')}
              >
                {book.title}
              </NavLink>
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
              </div>
            </div>
          </div>
          <div className="web-library-row-thread">
            {book.loop && <LibraryThreadProgress compact loop={book.loop} />}
            <div className="web-library-row-revision">
              <span>{t('libraryLatestRevision')}</span>
              {book.recentRevisions?.[0] ? (
                <div>
                  <strong>V{book.recentRevisions[0].version}</strong>
                  <time dateTime={book.recentRevisions[0].createdAt}>
                    {new Date(book.recentRevisions[0].createdAt).toLocaleDateString(locale)}
                  </time>
                </div>
              ) : (
                <small>{t('libraryRevisionEmpty')}</small>
              )}
            </div>
          </div>
          <div className="web-library-controls">
            <BookStatusSelect
              disabled={loading}
              id={`book-status-${book.bookId}-${instanceId}`}
              name={`readingStatus-${book.bookId}`}
              onChange={(status) => onStatusChange(book.bookId, status)}
              status={normalizeStatus(book.readingStatus)}
              statusLabel={statusLabel}
              testId={`saved-book-status-${book.bookId}`}
            />
            <BookRatingInput
              disabled={loading}
              onChange={(rating) => onRatingChange(book.bookId, rating)}
              rating={book.rating}
              testId={`saved-book-rating-${book.bookId}`}
            />
            <div className="web-library-actions flex gap-2">
              {book.loop && (
                <Button asChild size="sm" variant="outline">
                  <Link
                    onClick={() => onSelect(book)}
                    to={book.loop.continueLocator.href}
                    {...testAttr('saved-book-continue')}
                  >
                    {t('libraryThreadContinue')} →
                  </Link>
                </Button>
              )}
              <Button
                aria-label={`${book.title} ${t('delete')}`}
                disabled={loading}
                onClick={() => onDelete(book)}
                size="sm"
                type="button"
                variant="destructive"
                {...testAttr('saved-book-delete')}
              >
                {t('delete')}
              </Button>
            </div>
          </div>
        </article>
      ))}
      {!books.length && <div className="web-library-empty">{t('noSavedBooks')}</div>}
    </section>
  );
}
