import { ApiRequestError } from '@/lib/api-client';

export function reflectionErrorMessage(_error: unknown, safeMessage: string) {
  return safeMessage;
}

export function reflectionRequestId(error: unknown) {
  return error instanceof ApiRequestError ? error.requestId : undefined;
}
