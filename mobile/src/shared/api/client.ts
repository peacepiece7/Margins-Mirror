import { apiBaseUrl } from '@/shared/config';

import { apiErrorFromResponse, ApiRequestError } from './error';
import { postSse, type SseEvent } from './sse';
import type { ApiEnvelope, ApiRequestOptions, AuthBridge, SessionSnapshot } from './types';

const authRoutePrefixes = ['/api/auth/', '/api/mobile/auth/'];

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly authBridge?: AuthBridge,
  ) {}

  get<T>(path: string, options: Omit<ApiRequestOptions, 'body' | 'method'> = {}) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'body' | 'method'> = {}) {
    return this.request<T>(path, { ...options, body, method: 'POST' });
  }

  patch<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'body' | 'method'> = {}) {
    return this.request<T>(path, { ...options, body, method: 'PATCH' });
  }

  put<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'body' | 'method'> = {}) {
    return this.request<T>(path, { ...options, body, method: 'PUT' });
  }

  delete<T>(path: string, options: Omit<ApiRequestOptions, 'body' | 'method'> = {}) {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  request<T>(path: string, options: ApiRequestOptions = {}) {
    const bound = options.auth === false ? undefined : this.authBridge?.current();
    return this.perform<T>(path, options, bound, false);
  }

  stream<T>(
    path: string,
    body: unknown,
    onEvent?: (event: SseEvent) => void,
    signal?: AbortSignal,
  ) {
    const bound = this.authBridge?.current();
    return this.performStream<T>(path, body, bound, false, onEvent, signal);
  }

  private async performStream<T>(
    path: string,
    body: unknown,
    bound: SessionSnapshot | undefined,
    retried: boolean,
    onEvent?: (event: SseEvent) => void,
    signal?: AbortSignal,
  ): Promise<T> {
    if (!bound?.accessToken || !this.authBridge?.isCurrent(bound)) throw sessionChangedError();

    try {
      const current = this.authBridge.current();
      if (!current.accessToken) throw sessionChangedError();
      const result = await postSse<T>({
        accessToken: current.accessToken,
        baseUrl: this.baseUrl,
        body,
        onEvent,
        path,
        signal,
      });
      if (!this.authBridge.isCurrent(bound)) throw sessionChangedError();
      return result;
    } catch (error) {
      if (!(error instanceof ApiRequestError)) throw error;
      if (error.status === 428 || error.code === 'PRIVACY_CONSENT_REQUIRED') {
        this.authBridge.requireConsent();
      }
      if (error.status === 401 && !retried) {
        if (!this.authBridge.isCurrent(bound)) throw sessionChangedError();
        await this.authBridge.refresh(bound);
        if (!this.authBridge.isCurrent(bound)) throw sessionChangedError();
        return this.performStream<T>(path, body, bound, true, onEvent, signal);
      }
      if (error.status === 401 && retried && this.authBridge.isCurrent(bound)) {
        await this.authBridge.expire(bound);
      }
      throw error;
    }
  }

  private async perform<T>(
    path: string,
    options: ApiRequestOptions,
    bound: SessionSnapshot | undefined,
    retried: boolean,
  ): Promise<T> {
    if (bound && !this.authBridge?.isCurrent(bound)) throw sessionChangedError();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const current = this.authBridge?.current();
    if (bound && current?.accessToken) headers.Authorization = `Bearer ${current.accessToken}`;

    let response: Response;
    try {
      response = await fetch(new URL(path, this.baseUrl).toString(), {
        ...options,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers,
        method: options.method ?? 'GET',
      });
    } catch (error) {
      if (error instanceof ApiRequestError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiRequestError({ code: 'COMMON_REQUEST_ABORTED' });
      }
      throw new ApiRequestError({ code: 'COMMON_NETWORK_ERROR' });
    }

    const envelope = await readEnvelope<T>(response);
    if (response.status === 428 || envelope?.error?.code === 'PRIVACY_CONSENT_REQUIRED') {
      this.authBridge?.requireConsent();
    }

    if (
      response.status === 401 &&
      bound?.accessToken &&
      !retried &&
      !authRoutePrefixes.some((prefix) => path.startsWith(prefix)) &&
      this.authBridge
    ) {
      if (!this.authBridge.isCurrent(bound)) throw sessionChangedError();
      try {
        await this.authBridge.refresh(bound);
        if (!this.authBridge.isCurrent(bound)) throw sessionChangedError();
        return this.perform<T>(path, options, bound, true);
      } catch (error) {
        throw error;
      }
    }

    if (response.status === 401 && retried && bound && this.authBridge?.isCurrent(bound)) {
      await this.authBridge.expire(bound);
    }

    if (bound && !this.authBridge?.isCurrent(bound)) throw sessionChangedError();
    if (!response.ok || !envelope?.success) {
      throw apiErrorFromResponse(
        response.status,
        envelope?.error,
        response.headers.get('retry-after'),
      );
    }
    return envelope.data as T;
  }
}

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | undefined> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return undefined;
  }
}

function sessionChangedError() {
  return new ApiRequestError({ code: 'AUTH_SESSION_CHANGED', status: 401 });
}

export const publicApiClient = new ApiClient(apiBaseUrl);
