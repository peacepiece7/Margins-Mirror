import { describe, expect, it, vi } from 'vitest';

import { bookKeys, protectedQueryRoots, sessionKeys } from './query-keys';
import { createAppQueryClient, removeProtectedQueries } from './query-client';

describe('reading query client', () => {
  it('deduplicates simultaneous requests that use the same key', async () => {
    const client = createAppQueryClient();
    const request = vi.fn(async () => ({ books: [] }));

    const [first, second] = await Promise.all([
      client.fetchQuery({ queryKey: bookKeys.list(), queryFn: request }),
      client.fetchQuery({ queryKey: bookKeys.list(), queryFn: request }),
    ]);

    expect(request).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('keeps different resource identifiers in separate cache entries', async () => {
    const client = createAppQueryClient();
    await client.fetchQuery({
      queryKey: sessionKeys.timeline(1),
      queryFn: async () => ({ sessionId: 1 }),
    });
    await client.fetchQuery({
      queryKey: sessionKeys.timeline(2),
      queryFn: async () => ({ sessionId: 2 }),
    });

    expect(client.getQueryData(sessionKeys.timeline(1))).toEqual({ sessionId: 1 });
    expect(client.getQueryData(sessionKeys.timeline(2))).toEqual({ sessionId: 2 });
  });

  it('removes every protected account cache without touching unrelated cache', () => {
    const client = createAppQueryClient();
    client.setQueryData(bookKeys.list(), { books: [] });
    client.setQueryData([...protectedQueryRoots.account, 'detail'], { displayName: 'User one' });
    client.setQueryData([...protectedQueryRoots.memoryCards, 'groups'], { groups: [] });
    client.setQueryData(['public', 'catalog'], { entries: ['shared'] });

    removeProtectedQueries(client);

    expect(client.getQueryData(bookKeys.list())).toBeUndefined();
    expect(client.getQueryData([...protectedQueryRoots.account, 'detail'])).toBeUndefined();
    expect(client.getQueryData([...protectedQueryRoots.memoryCards, 'groups'])).toBeUndefined();
    expect(client.getQueryData(['public', 'catalog'])).toEqual({ entries: ['shared'] });
  });

  it('uses the reading server-state defaults', () => {
    const defaults = createAppQueryClient().getDefaultOptions();

    expect(defaults.queries).toMatchObject({
      staleTime: 60_000,
      retry: false,
      refetchOnWindowFocus: false,
    });
  });
});
