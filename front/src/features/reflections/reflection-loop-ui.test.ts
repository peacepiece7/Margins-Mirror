import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '@/lib/api-client';

import { reflectionErrorMessage, reflectionRequestId } from './reflection-loop-ui';

describe('reflectionErrorMessage', () => {
  it('keeps runtime and server details behind the public error boundary', () => {
    const runtimeError = new Error('private provider and request detail');

    expect(
      reflectionErrorMessage(runtimeError, '저장된 내용은 유지했습니다. 다시 시도해 주세요.'),
    ).toBe('저장된 내용은 유지했습니다. 다시 시도해 주세요.');
  });
});

describe('reflectionRequestId', () => {
  it('returns only the typed public API request id', () => {
    expect(
      reflectionRequestId(new ApiRequestError('COMMON_UPSTREAM_ERROR', 502, [], 'guide-request')),
    ).toBe('guide-request');
    expect(reflectionRequestId(new Error('private provider detail'))).toBeUndefined();
  });
});
