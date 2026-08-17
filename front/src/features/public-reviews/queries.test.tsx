import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { publicReviewKeys } from '@/lib/query-keys';
import { publicReviewsApi } from './api';
import { useReviewCommentMutations } from './queries';

describe('public review comment mutations', () => {
  it('invalidates only the changed insight comments', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(publicReviewKeys.comments(11), { comments: [] });
    client.setQueryData(publicReviewKeys.comments(12), { comments: [] });
    vi.spyOn(publicReviewsApi, 'createComment').mockResolvedValue({
      insightId: 11,
      comments: [],
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useReviewCommentMutations(), { wrapper });

    await act(() => result.current.create.mutateAsync({ insightId: 11, content: 'A comment' }));

    expect(client.getQueryState(publicReviewKeys.comments(11))?.isInvalidated).toBe(true);
    expect(client.getQueryState(publicReviewKeys.comments(12))?.isInvalidated).toBe(false);
  });
});
