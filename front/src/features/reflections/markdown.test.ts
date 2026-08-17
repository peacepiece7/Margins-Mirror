import { describe, expect, it } from 'vitest';
import { markdownToPlainText } from './markdown';

describe('markdownToPlainText', () => {
  it('extracts readable text from common markdown syntax', () => {
    expect(
      markdownToPlainText('## Title\n\n**bold** and [link](https://example.com)\n\n- item'),
    ).toBe('Title bold and link item');
  });

  it('treats syntax-only markdown as blank', () => {
    expect(markdownToPlainText('***\n> -')).toBe('');
  });
});
