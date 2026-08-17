import { describe, expect, it } from 'vitest';
import { testAttr } from './testAttrs';

describe('testAttr', () => {
  it('emits stable selectors outside production', () => {
    expect(testAttr('message-list', false)).toEqual({ 'data-testid': 'message-list' });
  });

  it('strips stable selectors in production', () => {
    expect(testAttr('message-list', true)).toEqual({});
  });
});
