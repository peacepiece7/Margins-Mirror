import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteJson, getJson } from '@/lib/api-client';

import { readingSessionsApi } from './api';

vi.mock('@/lib/api-client', () => ({
  deleteJson: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('readingSessionsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads an encoded reading-memory query', async () => {
    vi.mocked(getJson).mockResolvedValue({ query: 'Dune & ritual', results: [] });

    await readingSessionsApi.search('Dune & ritual');

    expect(getJson).toHaveBeenCalledWith('/api/reading-sessions/search?query=Dune%20%26%20ritual');
  });

  it('deletes a session-owned highlight through its scoped endpoint', async () => {
    vi.mocked(deleteJson).mockResolvedValue({});

    await readingSessionsApi.deleteHighlight(11, 31);

    expect(deleteJson).toHaveBeenCalledWith('/api/reading-sessions/11/highlights/31');
  });
});
