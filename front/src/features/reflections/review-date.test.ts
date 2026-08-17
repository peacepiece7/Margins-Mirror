import { describe, expect, it } from 'vitest';

import { dateInputValue } from './review-date';

describe('dateInputValue', () => {
  it('formats the browser-local calendar date for a date input', () => {
    expect(dateInputValue(new Date(2026, 6, 9, 23, 30))).toBe('2026-07-09');
  });
});
