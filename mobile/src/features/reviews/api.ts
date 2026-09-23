import type { ApiClient } from "@/shared/api/client";

import type {
  PublicReviewListResponse,
  ReviewCommentListResponse,
} from "./types";

export function createReviewsApi(client: ApiClient) {
  return {
    list: () =>
      client.get<PublicReviewListResponse>(
        "/api/reading-sessions/public-reviews",
      ),
    comments: (insightId: number) =>
      client.get<ReviewCommentListResponse>(
        `/api/reading-sessions/public-reviews/${insightId}/comments`,
      ),
    createComment: (
      insightId: number,
      content: string,
      parentCommentId?: number,
    ) =>
      client.post<ReviewCommentListResponse>(
        `/api/reading-sessions/public-reviews/${insightId}/comments`,
        { content, parentCommentId },
      ),
    updateComment: (insightId: number, commentId: number, content: string) =>
      client.patch<ReviewCommentListResponse>(
        `/api/reading-sessions/public-reviews/${insightId}/comments/${commentId}`,
        { content },
      ),
    deleteComment: (insightId: number, commentId: number) =>
      client.delete<ReviewCommentListResponse>(
        `/api/reading-sessions/public-reviews/${insightId}/comments/${commentId}`,
      ),
  };
}
