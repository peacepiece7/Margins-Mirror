import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';
import { postStream } from '@/lib/sse-client';

import { debatesApi } from './api';

vi.mock('@/lib/api-client', () => ({
  deleteJson: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

vi.mock('@/lib/sse-client', () => ({
  postStream: vi.fn(),
}));

describe('debatesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the book-scoped reading-session locator', async () => {
    vi.mocked(getJson).mockResolvedValue({ sessionId: 3, title: 'Dune reflection' });

    await debatesApi.readingSession(7);

    expect(getJson).toHaveBeenCalledWith('/api/books/7/reading-session');
  });

  it('loads encoded persona recommendations', async () => {
    vi.mocked(getJson).mockResolvedValue({ personas: [] });
    await debatesApi.recommendations(17);
    expect(getJson).toHaveBeenCalledWith('/api/personas/recommendations?bookId=17');
  });

  it('creates a window from explicit DTO fields', async () => {
    vi.mocked(postJson).mockResolvedValue({});
    await debatesApi.createWindow(3, 'debate', 'Debate: Power', [8, 7]);
    expect(postJson).toHaveBeenCalledWith('/api/session-windows', {
      sessionId: 3,
      windowType: 'debate',
      title: 'Debate: Power',
      personaIds: [8, 7],
    });
  });

  it('forwards message delta events from shared SSE transport', async () => {
    const deltas: string[] = [];
    vi.mocked(postStream).mockImplementation(async (_path, _body, onEvent) => {
      onEvent({ event: 'message.delta', data: { delta: 'Hello' } });
      onEvent({ event: 'message.done', data: {} });
      return { messageId: 1 } as never;
    });

    await debatesApi.streamMessage(3, 'Prompt', 4, (delta) => deltas.push(delta));

    expect(postStream).toHaveBeenCalledWith(
      '/api/session-windows/3/messages/stream',
      { content: 'Prompt', questionId: 4 },
      expect.any(Function),
    );
    expect(deltas).toEqual(['Hello']);
  });

  it('updates and deletes persisted messages', async () => {
    vi.mocked(patchJson).mockResolvedValue({});
    vi.mocked(deleteJson).mockResolvedValue({});
    await debatesApi.updateMessage(9, 'Edited');
    await debatesApi.deleteMessage(9);
    expect(patchJson).toHaveBeenCalledWith('/api/messages/9', { content: 'Edited' });
    expect(deleteJson).toHaveBeenCalledWith('/api/messages/9');
  });

  it('uses moderation-aware debate and feedback contracts', async () => {
    vi.mocked(postJson).mockResolvedValue({ messages: [] });

    await debatesApi.debate(3, 7, 'Prompt');
    await debatesApi.debateAll(3, 'Prompt', [7, 8]);
    await debatesApi.moderationFeedback(11, 'RELATED');

    expect(postJson).toHaveBeenNthCalledWith(1, '/api/session-windows/3/debate', {
      personaId: 7,
      content: 'Prompt',
    });
    expect(postJson).toHaveBeenNthCalledWith(2, '/api/session-windows/3/debate/all', {
      content: 'Prompt',
      personaIds: [7, 8],
    });
    expect(postJson).toHaveBeenNthCalledWith(3, '/api/moderation-events/11/feedback', {
      feedback: 'RELATED',
    });
  });
});
