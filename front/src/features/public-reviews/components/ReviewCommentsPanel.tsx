import { useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n } from '@/lib/i18n';
import type { ReviewComment } from '@/types/api/session';
import { testAttr } from '@/utils/testAttrs';
import { useReviewCommentsQuery, useReviewCommentMutations } from '../queries';
import type { ReviewCommentsPanelProps } from '../types/components';
import { ReviewCommentForm } from './ReviewCommentForm';

function displayDateTime(value: string | null | undefined, locale: 'en' | 'ko') {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US');
}

export function ReviewCommentsPanel({ insightId }: ReviewCommentsPanelProps) {
  const { t, locale } = useI18n();
  const currentSession = useAuthenticatedSessionGuard();
  const thread = useReviewCommentsQuery(insightId);
  const { create, update, remove } = useReviewCommentMutations(insightId);
  const [editing, setEditing] = useState<ReviewComment>();
  const [pendingDelete, setPendingDelete] = useState<number>();
  const inFlight = useRef(false);
  const comments = thread.data?.comments ?? [];
  const pending = thread.isFetching || create.isPending || update.isPending || remove.isPending;
  const deleteError = remove.error
    ? apiErrorMessage(remove.error, t, 'reviewCommentDeleteFailed')
    : '';
  const error = create.error
    ? apiErrorMessage(create.error, t, 'reviewCommentSaveFailed')
    : update.error
      ? apiErrorMessage(update.error, t, 'reviewCommentEditFailed')
      : deleteError ||
        (thread.error ? apiErrorMessage(thread.error, t, 'reviewCommentLoadFailed') : '');

  async function perform(request: () => Promise<unknown>) {
    // Query pending renders after the event; this lock also covers same-tick submits.
    if (inFlight.current || pending || !currentSession()) return false;
    inFlight.current = true;
    create.reset();
    update.reset();
    remove.reset();
    try {
      await request();
      return currentSession();
    } catch {
      // Query owns the failure; forms keep their drafts and the dialog remains retryable.
      return false;
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <div
      className="web-public-review-comments mt-4 grid gap-3 border-t border-stone-200 pt-4"
      {...testAttr('public-review-comments')}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{t('reviewCommentsTitle')}</h4>
        <Button
          className="px-3 py-1.5 text-xs"
          disabled={pending}
          onClick={() => void thread.refetch()}
          type="button"
          variant="outline"
          {...testAttr('public-review-comments-refresh')}
        >
          {t('publicReviewRefresh')}
        </Button>
      </div>
      {error && (
        <Alert role="status" variant="destructive" {...testAttr('public-review-comments-error')}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-2">
        {comments.map((comment) => (
          <article
            className={`rounded border border-stone-200 bg-stone-50 px-3 py-2 text-sm ${comment.parentCommentId ? 'ml-6' : ''}`}
            key={comment.commentId}
            {...testAttr('public-review-comment')}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-stone-500">
                {comment.authorName && <span>{comment.authorName}</span>}
                {comment.createdAt && <span>{displayDateTime(comment.createdAt, locale)}</span>}
              </div>
              {comment.ownedByCurrentReader && (
                <div className="flex gap-1">
                  <Button
                    className="px-2 py-1 text-xs"
                    disabled={pending}
                    onClick={() => {
                      update.reset();
                      setEditing(comment);
                    }}
                    type="button"
                    variant="outline"
                    {...testAttr('public-review-comment-edit')}
                  >
                    {t('edit')}
                  </Button>
                  <Button
                    className="px-2 py-1 text-xs"
                    disabled={pending}
                    onClick={() => {
                      remove.reset();
                      setPendingDelete(comment.commentId);
                    }}
                    type="button"
                    variant="destructive"
                    {...testAttr('public-review-comment-delete')}
                  >
                    {t('delete')}
                  </Button>
                </div>
              )}
            </div>
            {editing?.commentId === comment.commentId ? (
              <ReviewCommentForm
                kind="edit"
                initialContent={editing.content}
                pending={pending}
                onCancel={() => setEditing(undefined)}
                onSubmit={async (content) => {
                  const saved = await perform(() =>
                    update.mutateAsync({ commentId: comment.commentId, content }),
                  );
                  if (saved) setEditing(undefined);
                  return saved;
                }}
              />
            ) : (
              <div className="mt-1 whitespace-break-spaces leading-6 text-stone-800">
                {comment.content}
              </div>
            )}
            {!comment.parentCommentId && (
              <ReviewCommentForm
                kind="reply"
                pending={pending}
                onSubmit={(content) =>
                  perform(() => create.mutateAsync({ content, parentCommentId: comment.commentId }))
                }
              />
            )}
          </article>
        ))}
        {!pending && !comments.length && (
          <div
            className="rounded bg-stone-100 px-3 py-2 text-sm text-muted-foreground"
            {...testAttr('public-review-comments-empty')}
          >
            {t('reviewCommentEmpty')}
          </div>
        )}
      </div>
      <ReviewCommentForm
        kind="comment"
        pending={pending}
        onSubmit={(content) => perform(() => create.mutateAsync({ content }))}
      />
      <ConfirmActionDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        description={deleteError ? `${t('deleteConfirm')} ${deleteError}` : t('deleteConfirm')}
        loadingLabel={t('editorLoading')}
        title={t('delete')}
        open={pendingDelete !== undefined}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(undefined);
        }}
        onConfirm={async () => {
          if (
            pendingDelete === undefined ||
            !(await perform(() => remove.mutateAsync(pendingDelete)))
          ) {
            throw new Error('Comment deletion did not complete');
          }
        }}
      />
    </div>
  );
}
