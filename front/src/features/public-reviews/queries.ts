import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { publicReviewKeys } from '@/lib/query-keys';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import type { ReviewCommentListResponse } from '@/types/api/session';

import { publicReviewsApi } from './api';

export const publicReviewQueryOptions = {
  list: () => queryOptions({ queryKey: publicReviewKeys.list(), queryFn: publicReviewsApi.list }),
  comments: (insightId: number) =>
    queryOptions({
      queryKey: publicReviewKeys.comments(insightId),
      queryFn: () => publicReviewsApi.comments(insightId),
      enabled: Number.isSafeInteger(insightId) && insightId > 0,
    }),
};

export function usePublicReviewsQuery() {
  return useQuery(publicReviewQueryOptions.list());
}

export function useReviewCommentsQuery(insightId: number) {
  return useQuery(publicReviewQueryOptions.comments(insightId));
}

export function useReviewCommentMutations(insightId: number) {
  const queryClient = useQueryClient();
  const currentSession = useAuthenticatedSessionGuard();
  const onSuccess = (response: ReviewCommentListResponse) => {
    if (!currentSession()) return;
    const queryKey = publicReviewKeys.comments(insightId);
    queryClient.setQueryData(queryKey, response);
    return queryClient.invalidateQueries({ queryKey, exact: true });
  };
  const create = useMutation({
    mutationFn: ({ content, parentCommentId }: { content: string; parentCommentId?: number }) =>
      publicReviewsApi.createComment(insightId, content, parentCommentId),
    onSuccess,
  });
  const update = useMutation({
    mutationFn: ({ commentId, content }: { commentId: number; content: string }) =>
      publicReviewsApi.updateComment(insightId, commentId, content),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (commentId: number) => publicReviewsApi.deleteComment(insightId, commentId),
    onSuccess,
  });
  return { create, update, remove };
}
