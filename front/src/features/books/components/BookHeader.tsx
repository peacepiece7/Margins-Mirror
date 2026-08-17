import type { SaveBookResponse } from '@/types/api/book';
import { Link } from 'react-router-dom';
import { testAttr } from '@/utils/testAttrs';

import { bookPath } from '../routes';

export function BookHeader({
  book,
  sessionTitle,
}: {
  book: SaveBookResponse;
  sessionTitle?: string;
}) {
  return (
    <section
      className="margins-page-gutter border-b border-stone-300/80 bg-white/80 py-3 sm:py-4"
      {...testAttr('current-book-summary')}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[48px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-4">
        {book.coverImageUrl ? (
          <img
            alt={book.title}
            className="h-[4.5rem] w-12 rounded border border-stone-200 bg-white object-cover shadow-sm sm:h-24 sm:w-16"
            src={book.coverImageUrl}
            {...testAttr('current-book-cover')}
          />
        ) : (
          <div
            aria-hidden="true"
            className="grid h-[4.5rem] w-12 place-items-center rounded border border-stone-200 bg-stone-100 text-base font-semibold text-stone-400 shadow-sm sm:h-24 sm:w-16 sm:text-lg"
            {...testAttr('current-book-cover-placeholder')}
          >
            M
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span {...testAttr('current-book-status')}>{book.readingStatus ?? 'want_to_read'}</span>
            {book.rating !== undefined && (
              <span className="text-[var(--margins-gold)]" {...testAttr('current-book-rating')}>
                ★ {book.rating}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-6 sm:text-xl sm:leading-7">
            <Link
              className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              to={bookPath('book-detail', { bookId: book.bookId })}
              {...testAttr('current-book-title')}
            >
              {book.title}
            </Link>
          </h2>
          {book.subtitle && (
            <p className="mt-0.5 line-clamp-1 text-sm leading-5 text-stone-500">{book.subtitle}</p>
          )}
          {book.author && (
            <p
              className="mt-1 line-clamp-1 text-sm leading-5 text-stone-600"
              {...testAttr('current-book-author')}
            >
              {book.author}
            </p>
          )}
          {sessionTitle && (
            <div className="mt-2 line-clamp-1 text-sm font-medium text-stone-800 sm:mt-3">
              {sessionTitle}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
