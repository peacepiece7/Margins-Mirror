import type { ApiErrorPayload, ApiFieldError } from './types';

export class ApiRequestError extends Error {
  readonly code: string;
  readonly fields: ApiFieldError[];
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
  readonly status?: number;

  constructor({
    code,
    fields = [],
    requestId,
    retryAfterSeconds,
    status,
  }: {
    code: string;
    fields?: ApiFieldError[];
    requestId?: string;
    retryAfterSeconds?: number;
    status?: number;
  }) {
    super(code);
    this.name = 'ApiRequestError';
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = status;
  }
}

export function codeForStatus(status: number): string {
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

export function apiErrorFromResponse(
  status: number,
  error?: ApiErrorPayload | null,
  retryAfter?: string | null,
) {
  const parsedRetryAfter = Number(retryAfter);
  return new ApiRequestError({
    code: error?.code || codeForStatus(status),
    fields: error?.fields,
    requestId: error?.requestId,
    retryAfterSeconds:
      Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0
        ? Math.ceil(parsedRetryAfter)
        : undefined,
    status,
  });
}

export function isInvalidRefresh(error: unknown) {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}

export function isRetryableApiError(error: unknown) {
  return (
    error instanceof ApiRequestError &&
    (error.status === undefined || error.status === 429 || error.status >= 500)
  );
}
