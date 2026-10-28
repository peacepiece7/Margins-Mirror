import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "@/shared/api/api-client-provider";

import { createReviewsApi } from "./api";
import type { ReviewCommentListResponse } from "./types";

export const reviewKeys = {
  list: ["reviews", "public"] as const,
  comments: (insightId: number) =>
    ["reviews", "public", insightId, "comments"] as const,
};

export function usePublicReviewsQuery() {
  const api = createReviewsApi(useApiClient());
  return useQuery({ queryKey: reviewKeys.list, queryFn: api.list });
}

export function useReviewCommentsQuery(insightId: number, enabled: boolean) {
  const api = createReviewsApi(useApiClient());
  return useQuery({
    queryKey: reviewKeys.comments(insightId),
    queryFn: () => api.comments(insightId),
    enabled: enabled && Number.isSafeInteger(insightId) && insightId > 0,
  });
}

export function useReviewCommentMutations(insightId: number) {
  const api = createReviewsApi(useApiClient());
  const queryClient = useQueryClient();
  const replaceThread = (response: ReviewCommentListResponse) =>
    replaceReviewCommentThread(queryClient, insightId, response);
  return {
    create: useMutation({
      mutationFn: ({
        content,
        parentCommentId,
      }: {
        content: string;
        parentCommentId?: number;
      }) => api.createComment(insightId, content, parentCommentId),
      onSuccess: replaceThread,
    }),
    update: useMutation({
      mutationFn: ({
        commentId,
        content,
      }: {
        commentId: number;
        content: string;
      }) => api.updateComment(insightId, commentId, content),
      onSuccess: replaceThread,
    }),
    remove: useMutation({
      mutationFn: api.deleteComment.bind(api, insightId),
      onSuccess: replaceThread,
    }),
  };
}

export function replaceReviewCommentThread(
  queryClient: QueryClient,
  insightId: number,
  response: ReviewCommentListResponse,
) {
  queryClient.setQueryData(reviewKeys.comments(insightId), response);
}
