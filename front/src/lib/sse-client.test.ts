import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseStreamBlock, postStream } from './sse-client';

describe('SSE client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses LF and CRLF event blocks', () => {
    expect(parseStreamBlock('event: message.delta\ndata: {"delta":"LF"}')).toEqual({
      event: 'message.delta',
      data: { delta: 'LF' },
    });
    expect(parseStreamBlock('event: message.done\r\ndata: {"messageId":1}')).toEqual({
      event: 'message.done',
      data: { messageId: 1 },
    });
  });

  it('preserves a streaming error code without reading a server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            'event: message.error\ndata: {"code":"SESSION_LAST_WINDOW_REQUIRED","message":"raw"}\n\n',
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
          ),
        ),
    );

    await expect(postStream('/api/test', {}, vi.fn())).rejects.toMatchObject({
      code: 'SESSION_LAST_WINDOW_REQUIRED',
    });
  });
});
