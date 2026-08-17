import { useState, type FormEvent } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useI18n } from '@/lib/i18n';
import type { ReviewComment } from '@/types/api/session';

import {
  publicReviewQueryOptions,
  usePublicReviewsQuery,
  useReviewCommentMutations,
} from '../queries';
import { PublicReviewsPage } from './PublicReviewsPage';

export function PublicReviewsPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const reviews = usePublicReviewsQuery();
  const reviewItems = reviews.data?.reviews ?? [];
  const commentQueries = useQueries({
    queries: reviewItems.map((review) => publicReviewQueryOptions.comments(review.insightId)),
  });
  const mutations = useReviewCommentMutations();
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<number>();
  const [editingCommentDraft, setEditingCommentDraft] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{
    insightId: number;
    commentId: number;
  }>();
  const comments = Object.fromEntries(
    reviewItems.map((review, index) => [
      review.insightId,
      commentQueries[index]?.data?.comments ?? [],
    ]),
  );
  const commentsPending = Object.fromEntries(
    reviewItems.map((review, index) => [
      review.insightId,
      commentQueries[index]?.isFetching ?? false,
    ]),
  );
  const commentsError = Object.fromEntries(
    reviewItems.map((review, index) => [
      review.insightId,
      commentQueries[index]?.error
        ? apiErrorMessage(commentQueries[index].error, t, 'reviewCommentLoadFailed')
        : '',
    ]),
  );

  function submitComment(event: FormEvent, insightId: number, parentCommentId?: number) {
    event.preventDefault();
    const key = parentCommentId ?? insightId;
    const content = (parentCommentId ? replyDrafts[key] : commentDrafts[key])?.trim();
    if (!content) return;
    mutations.create.mutate(
      { insightId, content, parentCommentId },
      {
        onSuccess: () =>
          parentCommentId
            ? setReplyDrafts((current) => ({ ...current, [key]: '' }))
            : setCommentDrafts((current) => ({ ...current, [key]: '' })),
      },
    );
  }

  function startEdit(comment: ReviewComment) {
    setEditingCommentId(comment.commentId);
    setEditingCommentDraft(comment.content);
  }

  return (
    <>
      <PublicReviewsPage
        commentDrafts={commentDrafts}
        comments={comments}
        commentsError={commentsError}
        commentsPending={commentsPending}
        editingCommentDraft={editingCommentDraft}
        editingCommentId={editingCommentId}
        error={reviews.error ? apiErrorMessage(reviews.error, t, 'publicReviewLoadFailed') : ''}
        loaded={!reviews.isLoading}
        pending={reviews.isFetching}
        replyDrafts={replyDrafts}
        reviews={reviewItems}
        onCancelEdit={() => {
          setEditingCommentId(undefined);
          setEditingCommentDraft('');
        }}
        onCommentDraftChange={(insightId, value) =>
          setCommentDrafts((current) => ({ ...current, [insightId]: value }))
        }
        onDeleteComment={(insightId, commentId) => setPendingDelete({ insightId, commentId })}
        onEditingDraftChange={setEditingCommentDraft}
        onLoadComments={(insightId) => {
          const index = reviewItems.findIndex((review) => review.insightId === insightId);
          void commentQueries[index]?.refetch();
        }}
        onOpenBook={(bookId) => navigate(`/book/${bookId}`)}
        onRefresh={() => void reviews.refetch()}
        onReplyDraftChange={(commentId, value) =>
          setReplyDrafts((current) => ({ ...current, [commentId]: value }))
        }
        onStartEdit={startEdit}
        onSubmitComment={submitComment}
        onSubmitEdit={(event, insightId, commentId) => {
          event.preventDefault();
          if (!editingCommentDraft.trim()) return;
          mutations.update.mutate(
            { insightId, commentId, content: editingCommentDraft.trim() },
            {
              onSuccess: () => {
                setEditingCommentId(undefined);
                setEditingCommentDraft('');
              },
            },
          );
        }}
      />
      <ConfirmActionDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        description={t('deleteConfirm')}
        loadingLabel={t('editorLoading')}
        onConfirm={() => {
          if (pendingDelete) mutations.remove.mutate(pendingDelete);
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
