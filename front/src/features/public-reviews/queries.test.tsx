import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicReviewKeys } from '@/lib/query-keys';
import { publicReviewsApi } from './api';
import { useReviewCommentMutations } from './queries';

afterEach(() => vi.restoreAllMocks());

describe('public review comment mutations', () => {
  it.each(['create', 'update', 'remove'] as const)(
    '%s applies the returned thread and invalidates only the exact insight key',
    async (action) => {
      const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
      client.setQueryData(publicReviewKeys.comments(11), { comments: [] });
      client.setQueryData(publicReviewKeys.comments(12), { comments: [] });
      const descendant = [...publicReviewKeys.comments(11), 'other'];
      client.setQueryData(descendant, { comments: [] });
      const response = {
        insightId: 11,
        comments: [{ insightId: 11, commentId: 1, content: 'Server', ownedByCurrentReader: true }],
      };
      vi.spyOn(publicReviewsApi, 'createComment').mockResolvedValue(response);
      vi.spyOn(publicReviewsApi, 'updateComment').mockResolvedValue(response);
      vi.spyOn(publicReviewsApi, 'deleteComment').mockResolvedValue(response);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(() => useReviewCommentMutations(11), { wrapper });

      await act(async () => {
        if (action === 'create') await result.current.create.mutateAsync({ content: 'A comment' });
        if (action === 'update')
          await result.current.update.mutateAsync({ commentId: 1, content: 'Edited' });
        if (action === 'remove') await result.current.remove.mutateAsync(1);
      });

      expect(client.getQueryState(publicReviewKeys.comments(11))?.isInvalidated).toBe(true);
      expect(client.getQueryState(publicReviewKeys.comments(12))?.isInvalidated).toBe(false);
      expect(client.getQueryState(descendant)?.isInvalidated).toBe(false);
      expect(client.getQueryData(publicReviewKeys.comments(11))).toEqual(response);
    },
  );
});
