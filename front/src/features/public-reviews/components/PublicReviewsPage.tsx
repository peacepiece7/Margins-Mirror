import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { Skeleton } from '@/components/ui/legacy-skeleton';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import type { PublicReviewCardProps, PublicReviewsPageProps } from '../types/components';
import { ReviewCommentsPanel } from './ReviewCommentsPanel';

export function PublicReviewsPage({
  reviews,
  pending,
  loaded,
  error,
  onOpenBook,
  onRefresh,
}: PublicReviewsPageProps) {
  const { t } = useI18n();

  return (
    <section className="web-public-reviews-page grid gap-4" {...testAttr('public-reviews-page')}>
      <div className="web-public-reviews-header flex flex-wrap items-start justify-between gap-3 rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_18px_50px_rgba(23,23,23,0.06)] sm:p-5">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-normal">
            {t('publicReviewTitle')}
          </h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">{t('publicReviewSubtitle')}</p>
        </div>
        <Button
          className="px-4 py-2"
          loading={pending}
          onClick={onRefresh}
          type="button"
          variant="outline"
          {...testAttr('public-reviews-refresh')}
        >
          {t('publicReviewRefresh')}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" {...testAttr('public-reviews-error')}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="web-public-reviews-body">
        {reviews.length > 0 && (
          <aside className="web-public-review-index">
            <span className="blueprint-unit-label">PUBLIC INDEX</span>
            <nav aria-label={t('publicReviewTitle')}>
              {reviews.map((review) => (
                <a href={`#public-review-${review.insightId}`} key={review.insightId}>
                  <span>{review.title || review.bookTitle}</span>
                  <small>{review.authorName || review.bookAuthor}</small>
                </a>
              ))}
            </nav>
          </aside>
        )}
        <div className="web-public-review-list grid gap-3" {...testAttr('public-review-list')}>
          {pending &&
            !loaded &&
            [0, 1, 2].map((item) => (
              <article
                className="grid gap-3 rounded border border-stone-300 bg-white p-4"
                key={item}
                {...testAttr('public-review-skeleton')}
              >
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </article>
            ))}
          {reviews.map((review) => (
            <PublicReviewCard key={review.insightId} review={review} onOpenBook={onOpenBook} />
          ))}
          {!pending && loaded && !reviews.length && (
            <div
              className="rounded border border-stone-300 bg-stone-50/95 p-8 text-center text-sm text-stone-500"
              {...testAttr('public-reviews-empty')}
            >
              {t('publicReviewEmpty')}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PublicReviewCard({ review, onOpenBook }: PublicReviewCardProps) {
  const { t } = useI18n();

  return (
    <article
      className="web-public-review-card rounded border border-stone-300 bg-white p-4 shadow-[0_12px_36px_rgba(23,23,23,0.05)] sm:p-5"
      id={`public-review-${review.insightId}`}
      {...testAttr('public-review-card')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{review.title || review.bookTitle}</h3>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-stone-500">
            <span>
              {review.bookTitle}
              {review.bookAuthor ? ` · ${review.bookAuthor}` : ''}
            </span>
            <span>{review.sessionTitle}</span>
            {review.authorName && (
              <span>
                {t('reviewAuthorLabel')}: {review.authorName}
              </span>
            )}
            {review.reviewedOn && (
              <span>
                {t('reviewDateLabel')}: {review.reviewedOn}
              </span>
            )}
          </div>
        </div>
        <Button
          className="px-3 py-2"
          onClick={() => onOpenBook(review.bookId)}
          type="button"
          variant="outline"
          {...testAttr('public-review-book-link')}
        >
          {t('bookDetail')}
        </Button>
      </div>
      <MarkdownContent
        className="web-public-review-content mt-3 text-sm leading-7 text-stone-800"
        preserveLineBreaks
        value={review.content}
      />
      {review.evidence && (
        <div className="mt-3 rounded bg-stone-100 px-3 py-2 text-sm text-stone-600">
          {review.evidence}
        </div>
      )}
      <ReviewCommentsPanel insightId={review.insightId} />
    </article>
  );
}
