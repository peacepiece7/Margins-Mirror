import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';

import { publicReviewsApi } from './api';

vi.mock('@/lib/api-client', () => ({
  deleteJson: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('publicReviewsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads public reviews and a review comment thread', async () => {
    vi.mocked(getJson).mockResolvedValue({});
    await publicReviewsApi.list();
    await publicReviewsApi.comments(7);
    expect(getJson).toHaveBeenNthCalledWith(1, '/api/reading-sessions/public-reviews');
    expect(getJson).toHaveBeenNthCalledWith(2, '/api/reading-sessions/public-reviews/7/comments');
  });

  it('creates, updates, and deletes comments through scoped endpoints', async () => {
    vi.mocked(postJson).mockResolvedValue({});
    vi.mocked(patchJson).mockResolvedValue({});
    vi.mocked(deleteJson).mockResolvedValue({});
    await publicReviewsApi.createComment(7, 'Reply', 3);
    await publicReviewsApi.updateComment(7, 3, 'Edited');
    await publicReviewsApi.deleteComment(7, 3);
    expect(postJson).toHaveBeenCalledWith('/api/reading-sessions/public-reviews/7/comments', {
      content: 'Reply',
      parentCommentId: 3,
    });
    expect(patchJson).toHaveBeenCalledWith('/api/reading-sessions/public-reviews/7/comments/3', {
      content: 'Edited',
    });
    expect(deleteJson).toHaveBeenCalledWith('/api/reading-sessions/public-reviews/7/comments/3');
  });
});
