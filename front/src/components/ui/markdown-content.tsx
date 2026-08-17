import { Fragment, type ReactNode } from 'react';

interface MarkdownContentProps {
  className?: string;
  preserveLineBreaks?: boolean;
  value: string;
}

type MarkdownBlock =
  | { type: 'blockquote'; lines: string[] }
  | { type: 'code'; text: string }
  | { type: 'heading'; depth: 1 | 2 | 3; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'paragraph'; lines: string[] };

function safeUrl(value: string) {
  return /^(https?:|mailto:)/i.test(value) ? value : undefined;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index || 0;
    if (index > cursor) {
      nodes.push(text.slice(cursor, index));
    }

    if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = linkMatch ? safeUrl(linkMatch[2]) : undefined;
      nodes.push(
        href ? (
          <a className="underline underline-offset-2" href={href} rel="noreferrer" target="_blank">
            {linkMatch?.[1]}
          </a>
        ) : (
          token
        ),
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.92em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em>{token.slice(1, -1)}</em>);
    }

    cursor = index + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
}

function parseMarkdown(value: string) {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      index += lines[index]?.startsWith('```') ? 1 : 0;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', depth: heading[1].length as 1 | 2 | 3, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (
        index < lines.length &&
        (ordered ? /^\s*\d+\.\s+/.test(lines[index]) : /^\s*[-*]\s+/.test(lines[index]))
      ) {
        items.push(lines[index].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^\s*(?:[-*]|\d+\.)\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: 'paragraph', lines: paragraphLines });
  }

  return blocks;
}

function sanitizeLegacyHtml(value: string) {
  if (typeof document === 'undefined') {
    return value;
  }

  const allowedTags = new Set([
    'A',
    'BLOCKQUOTE',
    'BR',
    'EM',
    'H2',
    'H3',
    'I',
    'LI',
    'OL',
    'P',
    'STRONG',
    'UL',
  ]);
  const container = document.createElement('div');
  container.innerHTML = value;

  Array.from(container.querySelectorAll('script, style')).forEach((node) => node.remove());
  Array.from(container.querySelectorAll('*')).forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      if (element.tagName !== 'A' || attribute.name !== 'href') {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName === 'A') {
      const href = element.getAttribute('href') || '';
      if (!safeUrl(href)) {
        element.removeAttribute('href');
      }
      element.setAttribute('rel', 'noreferrer');
      element.setAttribute('target', '_blank');
    }
  });

  return container.innerHTML.trim();
}

function renderParagraphLines(lines: string[], preserveLineBreaks: boolean) {
  if (!preserveLineBreaks) {
    return renderInline(lines.join(' '));
  }

  return lines.map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {renderInline(line)}
      {lineIndex < lines.length - 1 && <br />}
    </Fragment>
  ));
}

export function MarkdownContent({
  className = '',
  preserveLineBreaks = false,
  value,
}: MarkdownContentProps) {
  const content = value.trim();
  const legacyHtml = /<\/?(?:p|blockquote|ul|ol|li|strong|em|h[23]|a)\b/i.test(content);

  if (legacyHtml) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitizeLegacyHtml(content) }}
      />
    );
  }

  return (
    <div className={className}>
      {parseMarkdown(content).map((block, index) => {
        if (block.type === 'heading') {
          const HeadingTag = `h${block.depth}` as 'h1' | 'h2' | 'h3';
          return (
            <HeadingTag className="mb-2 mt-3 font-semibold leading-7" key={index}>
              {renderInline(block.text)}
            </HeadingTag>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote
              className="my-2 border-l-2 border-stone-300 pl-3 text-stone-700"
              key={index}
            >
              {block.lines.map((line) => (
                <p className="mb-1" key={line}>
                  {renderInline(line)}
                </p>
              ))}
            </blockquote>
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              className={`my-2 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
              key={index}
            >
              {block.items.map((item) => (
                <li key={item}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'code') {
          return (
            <pre
              className="my-2 overflow-x-auto rounded bg-stone-100 p-3 font-mono text-xs leading-5"
              key={index}
            >
              {block.text}
            </pre>
          );
        }

        return (
          <p className="mb-2" key={index}>
            {renderParagraphLines(block.lines, preserveLineBreaks)}
          </p>
        );
      })}
    </div>
  );
}
