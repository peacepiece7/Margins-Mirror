import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './markdown-content';

describe('MarkdownContent', () => {
  it('preserves single line breaks and blank-line paragraph boundaries when requested', () => {
    const { container } = render(
      <MarkdownContent preserveLineBreaks value={'줄거리\nxxx\nyyy\n\nzzz'} />,
    );

    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelectorAll('br')).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent('줄거리xxxyyy');
    expect(paragraphs[1]).toHaveTextContent('zzz');
  });

  it('keeps Markdown constructs while preserving paragraph line breaks', () => {
    const { container } = render(
      <MarkdownContent
        preserveLineBreaks
        value={'**bold**\n[link](https://example.com)\n\n- first\n- `code`'}
      />,
    );

    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('a')).toHaveAttribute('href', 'https://example.com');
    expect(container.querySelector('p br')).toBeInTheDocument();
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('li code')).toHaveTextContent('code');
  });

  it('keeps sanitizing legacy HTML independently of line-break preservation', () => {
    const { container } = render(
      <MarkdownContent
        preserveLineBreaks
        value={
          '<p onclick="alert(1)">safe<br><strong>bold</strong><script>bad()</script><a href="javascript:bad()">link</a></p>'
        }
      />,
    );

    expect(container.querySelector('p')).not.toHaveAttribute('onclick');
    expect(container.querySelector('br')).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(container.querySelector('a')).not.toHaveAttribute('href');
  });
});
