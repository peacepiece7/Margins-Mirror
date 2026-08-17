import { ApiRequestError } from '@/lib/api-client';

export function reflectionErrorMessage(error: unknown, safeMessage: string) {
  return error instanceof ApiRequestError && error.message !== error.code
    ? error.message
    : safeMessage;
}

export function reflectionRequestId(error: unknown) {
  return error instanceof ApiRequestError ? error.requestId : undefined;
}
