import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '@/lib/api-client';

import { reflectionRequestId } from './reflection-loop-ui';

describe('reflectionRequestId', () => {
  it('returns only the typed public API request id', () => {
    expect(
      reflectionRequestId(new ApiRequestError('COMMON_UPSTREAM_ERROR', 502, [], 'guide-request')),
    ).toBe('guide-request');
    expect(reflectionRequestId(new Error('private provider detail'))).toBeUndefined();
  });
});
