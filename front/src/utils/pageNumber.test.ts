import { describe, expect, it } from 'vitest';
import { isOptionalPageNumberDraft, parseOptionalPageNumber } from './pageNumber';

describe('page number drafts', () => {
  it('parses blank or non-negative integer drafts', () => {
    expect(parseOptionalPageNumber('')).toBeUndefined();
    expect(parseOptionalPageNumber('  ')).toBeUndefined();
    expect(parseOptionalPageNumber('0')).toBe(0);
    expect(parseOptionalPageNumber('42')).toBe(42);
    expect(parseOptionalPageNumber(' 120 ')).toBe(120);
  });

  it('rejects decimal, signed, non-numeric, and unsafe drafts', () => {
    expect(parseOptionalPageNumber('1.5')).toBeUndefined();
    expect(parseOptionalPageNumber('-1')).toBeUndefined();
    expect(parseOptionalPageNumber('+1')).toBeUndefined();
    expect(parseOptionalPageNumber('12a')).toBeUndefined();
    expect(parseOptionalPageNumber('9007199254740992')).toBeUndefined();
  });

  it('validates optional drafts without requiring a value', () => {
    expect(isOptionalPageNumberDraft('')).toBe(true);
    expect(isOptionalPageNumberDraft('003')).toBe(true);
    expect(isOptionalPageNumberDraft('-3')).toBe(false);
    expect(isOptionalPageNumberDraft('3.5')).toBe(false);
  });
});
