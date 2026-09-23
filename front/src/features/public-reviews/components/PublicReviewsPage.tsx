import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { Skeleton } from '@/components/ui/legacy-skeleton';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { PublicReviewsPageProps } from '../panel-types';

function displayDateTime(value: string | undefined, locale: 'en' | 'ko') {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US');
}

export function PublicReviewsPage(props: PublicReviewsPageProps) {
  const { locale, t } = useI18n();
  const {
    commentDrafts,
    comments: reviewComments,
    commentsError: reviewCommentsError,
    commentsPending: reviewCommentsPending,
    editingCommentDraft,
    editingCommentId,
    error: publicReviewsError,
    loaded: publicReviewsLoaded,
    pending: publicReviewsPending,
    replyDrafts,
    reviews: publicReviews,
    onCancelEdit: cancelReviewCommentEdit,
    onCommentDraftChange,
    onDeleteComment: deleteReviewComment,
    onEditingDraftChange: setEditingCommentDraft,
    onLoadComments: loadReviewComments,
    onOpenBook,
    onRefresh: loadPublicReviews,
    onReplyDraftChange,
    onStartEdit: startReviewCommentEdit,
    onSubmitComment: submitReviewComment,
    onSubmitEdit: submitReviewCommentEdit,
  } = props;
  const setPublicReviewsLoaded = (_loaded: boolean) => undefined;
  const setCommentDrafts = (
    updater: (current: Record<number, string>) => Record<number, string>,
  ) => {
    const next = updater(commentDrafts);
    const changed = Object.keys(next).find(
      (key) => next[Number(key)] !== commentDrafts[Number(key)],
    );
    if (changed) onCommentDraftChange(Number(changed), next[Number(changed)]);
  };
  const setReplyDrafts = (updater: (current: Record<number, string>) => Record<number, string>) => {
    const next = updater(replyDrafts);
    const changed = Object.keys(next).find((key) => next[Number(key)] !== replyDrafts[Number(key)]);
    if (changed) onReplyDraftChange(Number(changed), next[Number(changed)]);
  };

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
          loading={publicReviewsPending}
          onClick={() => {
            setPublicReviewsLoaded(false);
            void loadPublicReviews();
          }}
          type="button"
          variant="outline"
          {...testAttr('public-reviews-refresh')}
        >
          {t('publicReviewRefresh')}
        </Button>
      </div>

      {publicReviewsError && (
        <Alert variant="destructive" {...testAttr('public-reviews-error')}>
          <AlertDescription>{publicReviewsError || t('publicReviewLoadFailed')}</AlertDescription>
        </Alert>
      )}

      <div className="web-public-reviews-body">
        {publicReviews.length > 0 && (
          <aside className="web-public-review-index">
            <span className="blueprint-unit-label">PUBLIC INDEX</span>
            <nav aria-label={t('publicReviewTitle')}>
              {publicReviews.map((review) => (
                <a href={`#public-review-${review.insightId}`} key={review.insightId}>
                  <span>{review.title || review.bookTitle}</span>
                  <small>{review.authorName || review.bookAuthor}</small>
                </a>
              ))}
            </nav>
          </aside>
        )}
        <div className="web-public-review-list grid gap-3" {...testAttr('public-review-list')}>
          {publicReviewsPending &&
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
          {!publicReviewsPending &&
            publicReviews.map((review) => (
              <article
                className="web-public-review-card rounded border border-stone-300 bg-white p-4 shadow-[0_12px_36px_rgba(23,23,23,0.05)] sm:p-5"
                id={`public-review-${review.insightId}`}
                key={review.insightId}
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
                <div
                  className="web-public-review-comments mt-4 grid gap-3 border-t border-stone-200 pt-4"
                  {...testAttr('public-review-comments')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">{t('reviewCommentsTitle')}</h4>
                    <Button
                      className="px-3 py-1.5 text-xs"
                      disabled={reviewCommentsPending[review.insightId]}
                      onClick={() => loadReviewComments(review.insightId)}
                      type="button"
                      variant="outline"
                      {...testAttr('public-review-comments-refresh')}
                    >
                      {t('publicReviewRefresh')}
                    </Button>
                  </div>
                  {reviewCommentsError[review.insightId] && (
                    <Alert
                      role="status"
                      variant="destructive"
                      {...testAttr('public-review-comments-error')}
                    >
                      <AlertDescription>{reviewCommentsError[review.insightId]}</AlertDescription>
                    </Alert>
                  )}
                  <div className="grid gap-2">
                    {(reviewComments[review.insightId] || []).map((comment) => (
                      <article
                        className={`rounded border border-stone-200 bg-stone-50 px-3 py-2 text-sm ${comment.parentCommentId ? 'ml-6' : ''}`}
                        key={comment.commentId}
                        {...testAttr('public-review-comment')}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-stone-500">
                            {comment.authorName && <span>{comment.authorName}</span>}
                            {comment.createdAt && (
                              <span>{displayDateTime(comment.createdAt, locale)}</span>
                            )}
                          </div>
                          {comment.ownedByCurrentReader && (
                            <div className="flex gap-1">
                              <Button
                                className="px-2 py-1 text-xs"
                                disabled={reviewCommentsPending[review.insightId]}
                                onClick={() => startReviewCommentEdit(comment)}
                                type="button"
                                variant="outline"
                                {...testAttr('public-review-comment-edit')}
                              >
                                {t('edit')}
                              </Button>
                              <Button
                                className="px-2 py-1 text-xs"
                                disabled={reviewCommentsPending[review.insightId]}
                                onClick={() =>
                                  deleteReviewComment(review.insightId, comment.commentId)
                                }
                                type="button"
                                variant="destructive"
                                {...testAttr('public-review-comment-delete')}
                              >
                                {t('delete')}
                              </Button>
                            </div>
                          )}
                        </div>
                        {editingCommentId === comment.commentId ? (
                          <form
                            className="mt-2 flex gap-2"
                            onSubmit={(event) =>
                              submitReviewCommentEdit(event, review.insightId, comment.commentId)
                            }
                            {...testAttr('public-review-comment-edit-form')}
                          >
                            <Input
                              className="min-w-0 flex-1"
                              onChange={(event) => setEditingCommentDraft(event.target.value)}
                              value={editingCommentDraft}
                              {...testAttr('public-review-comment-edit-input')}
                            />
                            <Button
                              className="px-3 py-2"
                              disabled={
                                reviewCommentsPending[review.insightId] ||
                                !editingCommentDraft.trim()
                              }
                              type="submit"
                              variant="default"
                              {...testAttr('public-review-comment-edit-submit')}
                            >
                              {t('saveEdit')}
                            </Button>
                            <Button
                              className="px-3 py-2"
                              onClick={cancelReviewCommentEdit}
                              type="button"
                              variant="outline"
                              {...testAttr('public-review-comment-edit-cancel')}
                            >
                              {t('workbenchCancel')}
                            </Button>
                          </form>
                        ) : (
                          <div className="mt-1 whitespace-break-spaces leading-6 text-stone-800">
                            {comment.content}
                          </div>
                        )}
                        {!comment.parentCommentId && (
                          <form
                            className="mt-2 flex gap-2"
                            onSubmit={(event) =>
                              submitReviewComment(event, review.insightId, comment.commentId)
                            }
                            {...testAttr('public-review-reply-form')}
                          >
                            <Input
                              className="min-w-0 flex-1"
                              onChange={(event) =>
                                setReplyDrafts((current) => ({
                                  ...current,
                                  [comment.commentId]: event.target.value,
                                }))
                              }
                              placeholder={t('reviewReplyPlaceholder')}
                              value={replyDrafts[comment.commentId] || ''}
                              {...testAttr('public-review-reply-input')}
                            />
                            <Button
                              className="px-3 py-2"
                              disabled={
                                reviewCommentsPending[review.insightId] ||
                                !replyDrafts[comment.commentId]?.trim()
                              }
                              type="submit"
                              variant="default"
                              {...testAttr('public-review-reply-submit')}
                            >
                              {t('reviewReplySubmit')}
                            </Button>
                          </form>
                        )}
                      </article>
                    ))}
                    {!reviewCommentsPending[review.insightId] &&
                      !(reviewComments[review.insightId] || []).length && (
                        <div
                          className="rounded bg-stone-100 px-3 py-2 text-sm text-stone-500"
                          {...testAttr('public-review-comments-empty')}
                        >
                          {t('reviewCommentEmpty')}
                        </div>
                      )}
                  </div>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => submitReviewComment(event, review.insightId)}
                    {...testAttr('public-review-comment-form')}
                  >
                    <Input
                      className="min-w-0 flex-1"
                      onChange={(event) =>
                        setCommentDrafts((current) => ({
                          ...current,
                          [review.insightId]: event.target.value,
                        }))
                      }
                      placeholder={t('reviewCommentPlaceholder')}
                      value={commentDrafts[review.insightId] || ''}
                      {...testAttr('public-review-comment-input')}
                    />
                    <Button
                      className="px-4 py-2"
                      disabled={
                        reviewCommentsPending[review.insightId] ||
                        !commentDrafts[review.insightId]?.trim()
                      }
                      type="submit"
                      variant="default"
                      {...testAttr('public-review-comment-submit')}
                    >
                      {t('reviewCommentSubmit')}
                    </Button>
                  </form>
                </div>
              </article>
            ))}
          {!publicReviewsPending && publicReviewsLoaded && !publicReviews.length && (
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
