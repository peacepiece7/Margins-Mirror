import { ApiRequestError } from '@/lib/api-client';

export function reflectionRequestId(error: unknown) {
  return error instanceof ApiRequestError ? error.requestId : undefined;
}
