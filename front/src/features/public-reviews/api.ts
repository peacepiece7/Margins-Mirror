import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';
import type { PublicReviewListResponse, ReviewCommentListResponse } from '@/types/api/session';

export const publicReviewsApi = {
  list(): Promise<PublicReviewListResponse> {
    return getJson('/api/reading-sessions/public-reviews');
  },

  comments(insightId: number): Promise<ReviewCommentListResponse> {
    return getJson(`/api/reading-sessions/public-reviews/${insightId}/comments`);
  },

  createComment(
    insightId: number,
    content: string,
    parentCommentId?: number,
  ): Promise<ReviewCommentListResponse> {
    return postJson(`/api/reading-sessions/public-reviews/${insightId}/comments`, {
      content,
      parentCommentId,
    });
  },

  updateComment(
    insightId: number,
    commentId: number,
    content: string,
  ): Promise<ReviewCommentListResponse> {
    return patchJson(`/api/reading-sessions/public-reviews/${insightId}/comments/${commentId}`, {
      content,
    });
  },

  deleteComment(insightId: number, commentId: number): Promise<ReviewCommentListResponse> {
    return deleteJson(`/api/reading-sessions/public-reviews/${insightId}/comments/${commentId}`);
  },
};
