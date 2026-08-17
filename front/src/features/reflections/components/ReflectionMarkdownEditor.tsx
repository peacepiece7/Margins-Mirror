import { ChangeEvent, useRef, useState } from 'react';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { testAttr } from '@/utils/testAttrs';

interface ReflectionMarkdownEditorProps {
  onChange: (value: string) => void;
  placeholder: string;
  textareaTestId?: string;
  value: string;
}

type MarkdownAction = 'blockquote' | 'bold' | 'code' | 'heading' | 'italic' | 'link' | 'list';

function applyMarkdownAction(action: MarkdownAction, selectedText: string) {
  const text = selectedText || 'text';

  if (action === 'bold') {
    return `**${text}**`;
  }
  if (action === 'italic') {
    return `*${text}*`;
  }
  if (action === 'heading') {
    return `## ${text}`;
  }
  if (action === 'list') {
    return selectedText
      ? selectedText
          .split('\n')
          .map((line) => `- ${line}`)
          .join('\n')
      : '- ';
  }
  if (action === 'blockquote') {
    return selectedText
      ? selectedText
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')
      : '> ';
  }
  if (action === 'code') {
    return selectedText.includes('\n') ? `\`\`\`\n${selectedText}\n\`\`\`` : `\`${text}\``;
  }
  return `[${text}](https://)`;
}

export function ReflectionMarkdownEditor({
  onChange,
  placeholder,
  textareaTestId,
  value,
}: ReflectionMarkdownEditorProps) {
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function changeValue(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  function insertMarkdown(action: MarkdownAction) {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const inserted = applyMarkdownAction(action, selected);
    const next = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
    onChange(next);

    window.requestAnimationFrame(() => {
      textarea.focus();
      const selectionEnd = start + inserted.length;
      textarea.setSelectionRange(selectionEnd, selectionEnd);
    });
  }

  return (
    <div className="reflection-markdown-editor flex min-h-[54vh] flex-col overflow-hidden rounded bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 bg-stone-50 px-2 py-2">
        <Button
          aria-label="Bold"
          className="editor-tool-button font-semibold"
          onClick={() => insertMarkdown('bold')}
          title="Bold"
          type="button"
        >
          B
        </Button>
        <Button
          aria-label="Italic"
          className="editor-tool-button italic"
          onClick={() => insertMarkdown('italic')}
          title="Italic"
          type="button"
        >
          I
        </Button>
        <Button
          aria-label="Heading"
          className="editor-tool-button"
          onClick={() => insertMarkdown('heading')}
          title="Heading"
          type="button"
        >
          H2
        </Button>
        <Button
          aria-label="List"
          className="editor-tool-button"
          onClick={() => insertMarkdown('list')}
          title="List"
          type="button"
        >
          -
        </Button>
        <Button
          aria-label="Quote"
          className="editor-tool-button"
          onClick={() => insertMarkdown('blockquote')}
          title="Quote"
          type="button"
        >
          "
        </Button>
        <Button
          aria-label="Code"
          className="editor-tool-button font-mono"
          onClick={() => insertMarkdown('code')}
          title="Code"
          type="button"
        >
          `
        </Button>
        <Button
          aria-label="Link"
          className="editor-tool-button"
          onClick={() => insertMarkdown('link')}
          title="Link"
          type="button"
        >
          []
        </Button>
        <Button
          className="ml-auto rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700"
          onClick={() => setPreview((current) => !current)}
          type="button"
        >
          {preview ? 'Write' : 'Preview'}
        </Button>
      </div>
      {preview ? (
        <MarkdownContent
          className="reflection-markdown-preview min-h-[54vh] flex-1 overflow-y-auto p-6 text-base leading-7 text-stone-900"
          preserveLineBreaks
          value={value}
        />
      ) : (
        <Textarea
          className="reflection-markdown-textarea min-h-[54vh] flex-1 resize-y border-0 bg-[var(--margins-paper)] p-6 text-base leading-7 text-stone-900 outline-none"
          onChange={changeValue}
          placeholder={placeholder}
          ref={textareaRef}
          value={value}
          {...(textareaTestId ? testAttr(textareaTestId) : {})}
        />
      )}
    </div>
  );
}
