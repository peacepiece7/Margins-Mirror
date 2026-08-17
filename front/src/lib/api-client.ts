import Axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import type { ApiFieldError, ApiResponse } from '@/types/api/api-response';
import type { LoginResponse } from '@/types/api/auth';

import {
  clearAuthSession,
  notifyAuthSessionExpired,
  readAuthSession,
  readAuthSessionLifetime,
  readAuthSessionRevision,
  writeAuthSession,
} from './auth-session';

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
    readonly fields: ApiFieldError[] = [],
    readonly requestId?: string,
    readonly retryAfterSeconds?: number,
    message?: string,
  ) {
    super(message || code);
    this.name = 'ApiRequestError';
  }
}

function notifyConsentRequired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('margins:consent-required'));
  }
}

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  marginsRetried?: boolean;
  marginsSessionBound?: boolean;
  marginsSessionUserId?: number;
  marginsSessionAccessToken?: string;
  marginsSessionRevision?: number;
  marginsSessionLifetime?: number;
};

function requestHeaders(config: InternalAxiosRequestConfig): Record<string, string> {
  return Object.fromEntries(
    Object.entries(config.headers.toJSON()).map(([key, value]) => [key, String(value)]),
  );
}

const fetchAdapter: AxiosAdapter = async (config) => {
  const method = (config.method || 'get').toUpperCase();
  const retryableConfig = config as RetryableRequestConfig;
  const session = readAuthSession();
  if (retryableConfig.marginsSessionBound && !requestMatchesSession(retryableConfig, session)) {
    throw sessionChangedError();
  }
  const headers = requestHeaders(config);
  if (retryableConfig.marginsSessionBound) {
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    else delete headers.Authorization;
  }
  const response = await fetch(config.url || '', {
    method,
    credentials: config.withCredentials ? 'include' : 'same-origin',
    headers,
    body: ['GET', 'HEAD'].includes(method)
      ? undefined
      : (config.data as BodyInit | null | undefined),
    signal: config.signal as AbortSignal | undefined,
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }

  const axiosResponse: AxiosResponse = {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: AxiosHeaders.from(Object.fromEntries(response.headers.entries())),
    config: config as InternalAxiosRequestConfig,
    request: response,
  };

  if (!response.ok) {
    throw new AxiosError(
      `Request failed with status code ${response.status}`,
      AxiosError.ERR_BAD_RESPONSE,
      config,
      response,
      axiosResponse,
    );
  }
  return axiosResponse;
};

function addAuthHeader(config: RetryableRequestConfig) {
  config.withCredentials = true;
  config.headers.set('Content-Type', 'application/json');
  if (!config.marginsSessionBound) {
    const session = readAuthSession();
    config.marginsSessionBound = true;
    config.marginsSessionUserId = session?.userId;
    config.marginsSessionAccessToken = session?.accessToken;
    config.marginsSessionRevision = readAuthSessionRevision();
    config.marginsSessionLifetime = readAuthSessionLifetime();
  }
  const token = readAuthSession()?.accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
}

function requestMatchesSession(config: RetryableRequestConfig, session: LoginResponse | undefined) {
  if (!config.marginsSessionBound) return false;
  if (config.marginsSessionLifetime !== readAuthSessionLifetime()) return false;
  if (config.marginsSessionUserId === undefined || config.marginsSessionAccessToken === undefined) {
    return !session;
  }
  return Boolean(session && session.userId === config.marginsSessionUserId);
}

function requestUsesRotatedAccessToken(
  config: RetryableRequestConfig,
  session: LoginResponse,
): boolean {
  return Boolean(
    config.marginsSessionUserId !== undefined &&
    config.marginsSessionAccessToken !== undefined &&
    session.userId === config.marginsSessionUserId &&
    session.accessToken !== config.marginsSessionAccessToken,
  );
}

function unwrapEnvelope<T>(response: AxiosResponse<ApiResponse<T>>): T {
  if (!response.data?.success) {
    const error = response.data?.error;
    throw new ApiRequestError(
      error?.code || codeForStatus(response.status),
      response.status,
      error?.fields,
      error?.requestId,
      undefined,
      error?.message,
    );
  }
  return response.data.data as T;
}

function toApiRequestError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;
  if (error instanceof AxiosError) {
    const envelope = error.response?.data as ApiResponse<unknown> | undefined;
    return new ApiRequestError(
      envelope?.error?.code ||
        (error.response?.status ? codeForStatus(error.response.status) : 'COMMON_NETWORK_ERROR'),
      error.response?.status,
      envelope?.error?.fields,
      envelope?.error?.requestId,
      parseRetryAfter(error.response?.headers?.['retry-after']),
      envelope?.error?.message,
    );
  }
  return new ApiRequestError('COMMON_REQUEST_FAILED');
}

function parseRetryAfter(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : undefined;
}

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'COMMON_BAD_REQUEST';
    case 401:
      return 'COMMON_UNAUTHORIZED';
    case 403:
      return 'COMMON_FORBIDDEN';
    case 404:
      return 'COMMON_NOT_FOUND';
    case 409:
      return 'COMMON_CONFLICT';
    case 428:
      return 'COMMON_PRECONDITION_REQUIRED';
    case 429:
      return 'COMMON_RATE_LIMITED';
    case 502:
      return 'COMMON_UPSTREAM_ERROR';
    case 503:
      return 'COMMON_SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'COMMON_INTERNAL_ERROR' : 'COMMON_REQUEST_FAILED';
  }
}

const authClient = Axios.create({ adapter: fetchAdapter });
authClient.interceptors.request.use(addAuthHeader);

async function requestAuthJson<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await authClient.request<ApiResponse<T>>(config);
    return unwrapEnvelope(response);
  } catch (error) {
    throw toApiRequestError(error);
  }
}

type RefreshInFlight = {
  session: LoginResponse | undefined;
  lifetime: number;
  promise: Promise<LoginResponse>;
};

let refreshInFlight: RefreshInFlight | undefined;

function sameSessionIdentity(
  left: LoginResponse | undefined,
  right: LoginResponse | undefined,
): boolean {
  if (!left || !right) return !left && !right;
  return left.userId === right.userId && left.accessToken === right.accessToken;
}

function sessionChangedError(): ApiRequestError {
  return new ApiRequestError('AUTH_SESSION_CHANGED', 401);
}

function isSessionChangedError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === 'AUTH_SESSION_CHANGED';
}

function refreshContextMatches(
  sessionBeforeRefresh: LoginResponse | undefined,
  revisionBeforeRefresh: number,
  lifetimeBeforeRefresh: number,
): boolean {
  return (
    readAuthSessionRevision() === revisionBeforeRefresh &&
    readAuthSessionLifetime() === lifetimeBeforeRefresh &&
    sameSessionIdentity(readAuthSession(), sessionBeforeRefresh)
  );
}

export function shouldMarkInvalidRefresh(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}

export async function rotateRefreshToken(): Promise<LoginResponse> {
  const sessionBeforeRefresh = readAuthSession();
  const revisionBeforeRefresh = readAuthSessionRevision();
  const lifetimeBeforeRefresh = readAuthSessionLifetime();
  let session: LoginResponse;
  try {
    session = await requestAuthJson<LoginResponse>({
      url: '/api/auth/refresh',
      method: 'POST',
      data: {},
    });
  } catch (error) {
    if (
      !refreshContextMatches(sessionBeforeRefresh, revisionBeforeRefresh, lifetimeBeforeRefresh)
    ) {
      throw sessionChangedError();
    }
    throw error;
  }

  if (
    !refreshContextMatches(sessionBeforeRefresh, revisionBeforeRefresh, lifetimeBeforeRefresh) ||
    (sessionBeforeRefresh && session.userId !== sessionBeforeRefresh.userId)
  ) {
    throw sessionChangedError();
  }

  writeAuthSession(session, { preserveLifetime: Boolean(sessionBeforeRefresh) });
  return session;
}

async function ensureRefreshedSession(
  sessionAtRequest: LoginResponse | undefined = readAuthSession(),
  sessionLifetimeAtRequest: number = readAuthSessionLifetime(),
): Promise<LoginResponse> {
  const currentSession = readAuthSession();
  if (
    readAuthSessionLifetime() !== sessionLifetimeAtRequest ||
    !sameSessionIdentity(currentSession, sessionAtRequest)
  ) {
    throw sessionChangedError();
  }

  if (
    refreshInFlight &&
    refreshInFlight.lifetime === sessionLifetimeAtRequest &&
    sameSessionIdentity(refreshInFlight.session, currentSession)
  ) {
    return refreshInFlight.promise;
  }

  const promise = rotateRefreshToken();
  refreshInFlight = { session: currentSession, lifetime: sessionLifetimeAtRequest, promise };
  void promise.then(
    () => {
      if (refreshInFlight?.promise === promise) refreshInFlight = undefined;
    },
    () => {
      if (refreshInFlight?.promise === promise) refreshInFlight = undefined;
    },
  );
  return promise;
}

function isRetriableAuthPath(path: string): boolean {
  return !path.startsWith('/api/auth/');
}

const apiClient = Axios.create({ adapter: fetchAdapter });
apiClient.interceptors.request.use(addAuthHeader);
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 428) notifyConsentRequired();
    const config = error.config as RetryableRequestConfig | undefined;
    const currentSession = readAuthSession();
    if (
      error.response?.status === 401 &&
      config &&
      !config.marginsRetried &&
      isRetriableAuthPath(config.url || '') &&
      currentSession
    ) {
      if (!requestMatchesSession(config, currentSession)) return Promise.reject(error);
      config.marginsRetried = true;
      const sessionAtRetry = currentSession;
      const sessionRevisionAtRetry = config.marginsSessionRevision;
      const sessionLifetimeAtRetry = config.marginsSessionLifetime;
      if (requestUsesRotatedAccessToken(config, currentSession)) {
        return apiClient.request(config);
      }
      try {
        const refreshed = await ensureRefreshedSession(sessionAtRetry, sessionLifetimeAtRetry);
        if (!sameSessionIdentity(readAuthSession(), refreshed)) throw sessionChangedError();
        return apiClient.request(config);
      } catch (refreshError) {
        if (
          !isSessionChangedError(refreshError) &&
          sameSessionIdentity(readAuthSession(), sessionAtRetry) &&
          readAuthSessionRevision() === sessionRevisionAtRetry &&
          readAuthSessionLifetime() === sessionLifetimeAtRetry
        ) {
          clearAuthSession({ clearRefreshHint: shouldMarkInvalidRefresh(refreshError) });
          notifyAuthSessionExpired();
        }
      }
    }
    return Promise.reject(error);
  },
);

async function requestJson<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await apiClient.request<ApiResponse<T>>(config);
    return unwrapEnvelope(response);
  } catch (error) {
    throw toApiRequestError(error);
  }
}

export function authJson<T>(config: AxiosRequestConfig): Promise<T> {
  return requestAuthJson<T>(config);
}

export function getJson<T>(url: string): Promise<T> {
  return requestJson<T>({ url, method: 'GET' });
}

export function postJson<T>(url: string, data: unknown): Promise<T> {
  return requestJson<T>({ url, method: 'POST', data });
}

export function patchJson<T>(url: string, data: unknown): Promise<T> {
  return requestJson<T>({ url, method: 'PATCH', data });
}

export function putJson<T>(url: string, data: unknown): Promise<T> {
  return requestJson<T>({ url, method: 'PUT', data });
}

export function deleteJson<T>(url: string): Promise<T> {
  return requestJson<T>({ url, method: 'DELETE' });
}

export async function fetchWithAuthRetry(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<Response> {
  const session = readAuthSession();
  const sessionRevision = readAuthSessionRevision();
  const sessionLifetime = readAuthSessionLifetime();
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 428) notifyConsentRequired();

  if (response.status === 401 && !retried && isRetriableAuthPath(path) && session) {
    const currentSession = readAuthSession();
    if (
      readAuthSessionLifetime() !== sessionLifetime ||
      !currentSession ||
      currentSession.userId !== session.userId
    ) {
      return response;
    }
    if (currentSession.accessToken !== session.accessToken) {
      return fetchWithAuthRetry(path, init, true);
    }
    try {
      const refreshed = await ensureRefreshedSession(session, sessionLifetime);
      if (!sameSessionIdentity(readAuthSession(), refreshed)) return response;
      return fetchWithAuthRetry(path, init, true);
    } catch (refreshError) {
      if (
        !isSessionChangedError(refreshError) &&
        sameSessionIdentity(readAuthSession(), session) &&
        readAuthSessionRevision() === sessionRevision &&
        readAuthSessionLifetime() === sessionLifetime
      ) {
        clearAuthSession({ clearRefreshHint: shouldMarkInvalidRefresh(refreshError) });
        notifyAuthSessionExpired();
      }
    }
  }
  return response;
}

export async function readFetchEnvelope<T>(response: Response): Promise<T> {
  let result: ApiResponse<T> | undefined;
  try {
    result = (await response.json()) as ApiResponse<T>;
  } catch {
    result = undefined;
  }
  if (!response.ok || !result?.success) {
    const error = result?.error;
    throw new ApiRequestError(
      error?.code || codeForStatus(response.status),
      response.status,
      error?.fields,
      error?.requestId,
    );
  }
  return result.data as T;
}
