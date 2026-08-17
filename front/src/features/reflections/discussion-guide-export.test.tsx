import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadDiscussionGuideMarkdown } from './discussion-guide-export';

describe('downloadDiscussionGuideMarkdown', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads the server-provided versioned UTF-8 Markdown and revokes the URL', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:discussion-guide');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    downloadDiscussionGuideMarkdown({
      content: '# 참여자 발제문',
      filename: 'book-v2-participant.md',
      guideId: 7,
      guideVersion: 2,
      projection: 'PARTICIPANT',
    });

    expect(createObjectUrl).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'text/markdown;charset=utf-8' }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:discussion-guide');
    expect(document.querySelector('a[download="book-v2-participant.md"]')).toBeNull();
  });
});
