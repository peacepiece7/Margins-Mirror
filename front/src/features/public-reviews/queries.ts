import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { publicReviewKeys } from '@/lib/query-keys';

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

export function useReviewCommentsQuery(insightId: number, enabled = true) {
  return useQuery({ ...publicReviewQueryOptions.comments(insightId), enabled });
}

export function useCreateReviewCommentMutation(insightId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, parentCommentId }: { content: string; parentCommentId?: number }) =>
      publicReviewsApi.createComment(insightId, content, parentCommentId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: publicReviewKeys.comments(insightId) }),
  });
}

export function useUpdateReviewCommentMutation(insightId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: number; content: string }) =>
      publicReviewsApi.updateComment(insightId, commentId, content),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: publicReviewKeys.comments(insightId) }),
  });
}

export function useDeleteReviewCommentMutation(insightId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => publicReviewsApi.deleteComment(insightId, commentId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: publicReviewKeys.comments(insightId) }),
  });
}

export function useReviewCommentMutations() {
  const queryClient = useQueryClient();
  const invalidate = (insightId: number) =>
    queryClient.invalidateQueries({ queryKey: publicReviewKeys.comments(insightId) });
  const create = useMutation({
    mutationFn: ({
      insightId,
      content,
      parentCommentId,
    }: {
      insightId: number;
      content: string;
      parentCommentId?: number;
    }) => publicReviewsApi.createComment(insightId, content, parentCommentId),
    onSuccess: (_, input) => invalidate(input.insightId),
  });
  const update = useMutation({
    mutationFn: ({
      insightId,
      commentId,
      content,
    }: {
      insightId: number;
      commentId: number;
      content: string;
    }) => publicReviewsApi.updateComment(insightId, commentId, content),
    onSuccess: (_, input) => invalidate(input.insightId),
  });
  const remove = useMutation({
    mutationFn: ({ insightId, commentId }: { insightId: number; commentId: number }) =>
      publicReviewsApi.deleteComment(insightId, commentId),
    onSuccess: (_, input) => invalidate(input.insightId),
  });
  return { create, update, remove };
}
