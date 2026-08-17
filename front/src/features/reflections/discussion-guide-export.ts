import type { DiscussionGuideMarkdownExportResponse } from '@/types/api/reflection-loop';

export function downloadDiscussionGuideMarkdown(exported: DiscussionGuideMarkdownExportResponse) {
  const blob = new Blob([exported.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = exported.filename;
  anchor.hidden = true;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
