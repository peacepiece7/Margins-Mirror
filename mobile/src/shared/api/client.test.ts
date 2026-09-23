import { ApiClient } from './client';
import type { AuthBridge, SessionSnapshot } from './types';

const mockExpoFetch = jest.fn();
jest.mock('expo/fetch', () => ({
  fetch: (...args: unknown[]) => mockExpoFetch(...args),
}));

function response(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...headers },
    status,
  });
}

function success<T>(data: T) {
  return { data, error: null, success: true };
}

function failure(code: string, message = 'private backend detail') {
  return { data: null, error: { code, fields: [], message, requestId: 'request-1' }, success: false };
}

describe('ApiClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    mockExpoFetch.mockReset();
    global.fetch = fetchMock;
  });

  it('adds the current bearer and unwraps the common envelope', async () => {
    const bridge = authBridge();
    fetchMock.mockResolvedValue(response(200, success({ title: 'Margins' })));

    const result = await new ApiClient('https://api.example.test', bridge).get<{ title: string }>(
      '/api/books',
    );

    expect(result).toEqual({ title: 'Margins' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/books',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-1' }) }),
    );
  });

  it('rotates once and retries an unauthorized request at most once', async () => {
    const bridge = authBridge();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const authorization = (init.headers as Record<string, string>).Authorization;
      return Promise.resolve(
        authorization === 'Bearer access-1'
          ? response(401, failure('COMMON_UNAUTHORIZED'))
          : response(200, success({ ok: true })),
      );
    });

    await expect(
      new ApiClient('https://api.example.test', bridge).post('/api/books', { title: 'A' }),
    ).resolves.toEqual({ ok: true });
    expect(bridge.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('publishes consent-required and never exposes a raw backend message', async () => {
    const bridge = authBridge();
    fetchMock.mockResolvedValue(
      response(428, failure('PRIVACY_CONSENT_REQUIRED', 'sensitive internal explanation')),
    );

    const promise = new ApiClient('https://api.example.test', bridge).get('/api/books');
    await expect(promise).rejects.toMatchObject({
      code: 'PRIVACY_CONSENT_REQUIRED',
      message: 'PRIVACY_CONSENT_REQUIRED',
      requestId: 'request-1',
    });
    expect(bridge.requireConsent).toHaveBeenCalledTimes(1);
  });

  it('rejects a response when the principal lifetime changed in flight', async () => {
    const bridge = authBridge();
    let resolveFetch!: (value: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (resolveFetch = resolve)));
    const promise = new ApiClient('https://api.example.test', bridge).get('/api/books');
    (bridge.isCurrent as jest.Mock).mockReturnValue(false);
    resolveFetch(response(200, success({ ok: true })));

    await expect(promise).rejects.toEqual(expect.objectContaining({ code: 'AUTH_SESSION_CHANGED' }));
  });

  it('refreshes and retries a stream once only when 401 arrives before body bytes', async () => {
    const bridge = authBridge();
    mockExpoFetch.mockImplementation((_url: string, init: RequestInit) => {
      const authorization = (init.headers as Record<string, string>).Authorization;
      return Promise.resolve(
        authorization === 'Bearer access-1'
          ? response(401, failure('COMMON_UNAUTHORIZED'))
          : new Response('event: message.done\ndata: {"messageId":9}\n\n', {
              headers: { 'Content-Type': 'text/event-stream' },
              status: 200,
            }),
      );
    });

    await expect(
      new ApiClient('https://api.example.test', bridge).stream<{ messageId: number }>(
        '/api/session-windows/3/messages/stream',
        { content: 'Question' },
      ),
    ).resolves.toEqual({ messageId: 9 });
    expect(bridge.refresh).toHaveBeenCalledTimes(1);
    expect(mockExpoFetch).toHaveBeenCalledTimes(2);
  });

  it('does not refresh when an SSE event fails after response bytes arrive', async () => {
    const bridge = authBridge();
    mockExpoFetch.mockResolvedValue(
      new Response('event: message.error\ndata: {"code":"COMMON_UNAUTHORIZED"}\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
        status: 200,
      }),
    );

    await expect(
      new ApiClient('https://api.example.test', bridge).stream(
        '/api/session-windows/3/messages/stream',
        { content: 'Question' },
      ),
    ).rejects.toMatchObject({ code: 'COMMON_UNAUTHORIZED', status: undefined });
    expect(bridge.refresh).not.toHaveBeenCalled();
    expect(mockExpoFetch).toHaveBeenCalledTimes(1);
  });
});

function authBridge(): AuthBridge {
  let snapshot: SessionSnapshot = { accessToken: 'access-1', lifetime: 1, userId: 7 };
  return {
    current: jest.fn(() => snapshot),
    expire: jest.fn(async () => undefined),
    isCurrent: jest.fn((bound) => bound.lifetime === snapshot.lifetime && bound.userId === snapshot.userId),
    refresh: jest.fn(async () => {
      snapshot = { ...snapshot, accessToken: 'access-2' };
      return snapshot;
    }),
    requireConsent: jest.fn(),
  };
}
