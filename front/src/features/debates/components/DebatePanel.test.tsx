import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DebatePanel } from './DebatePanel';

vi.mock('@/components/ui/ai-processing-notice', () => ({
  AiProcessingNotice: () => null,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const debateMutate = vi.fn();
const debateAllMutate = vi.fn();
let debatePending = false;
let debateError = false;
let timelineFetching = false;
let timelineMessages: Array<{
  messageId: number;
  sessionId: number;
  windowId: number;
  role: string;
  content: string;
  createdAt: string;
}> = [];

vi.mock('../queries', () => ({
  useDebateTimelineForBook: () => ({
    sessionId: 3,
    timeline: {
      data: {
        windows: [
          {
            windowId: 13,
            sessionId: 3,
            windowType: 'debate',
            title: 'Debate: 같은 주제',
            personaIds: [7],
          },
        ],
        messages: timelineMessages,
        moderationEvents: [],
        questions: [],
        insights: [],
      },
      isFetching: timelineFetching,
    },
  }),
  usePersonasQuery: () => ({
    data: {
      personas: [{ personaId: 7, displayName: 'Reader', name: 'reader' }],
    },
  }),
  usePersonaRecommendationsQuery: () => ({
    data: {
      personas: [{ personaId: 7, displayName: 'Reader', name: 'reader' }],
    },
  }),
  useDebateMutation: () => ({
    isError: debateError,
    isPending: debatePending,
    mutate: debateMutate,
  }),
  useDebateAllMutation: () => ({
    isError: false,
    isPending: false,
    mutate: debateAllMutate,
  }),
  useModerationFeedbackMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));

vi.mock('./DebatePage', () => ({
  DebatePage: ({
    loading,
    messages,
    showReplySkeleton,
    onPersonaReply,
  }: {
    loading: boolean;
    messages: Array<{ id: string; content: string }>;
    showReplySkeleton: boolean;
    onPersonaReply: (personaId: number) => void;
  }) => (
    <div>
      <div data-testid="messages">
        {messages.map((message) => (
          <span key={message.id}>{message.content}</span>
        ))}
      </div>
      {showReplySkeleton ? <div data-testid="reply-skeleton" /> : null}
      <button disabled={loading} onClick={() => onPersonaReply(7)} type="button">
        reply
      </button>
    </div>
  ),
}));

describe('DebatePanel optimistic message lifecycle', () => {
  afterEach(cleanup);

  beforeEach(() => {
    debateMutate.mockReset();
    debateAllMutate.mockReset();
    debatePending = false;
    debateError = false;
    timelineFetching = false;
    timelineMessages = [];
  });

  it('shows an optimistic reader message on an empty timeline and blocks resubmission while pending', () => {
    const { rerender } = render(<DebatePanel bookId={1} windowId={13} />);

    fireEvent.click(screen.getByRole('button', { name: 'reply' }));

    expect(screen.getByText('같은 주제')).toBeVisible();
    expect(debateMutate).toHaveBeenCalledOnce();

    debatePending = true;
    rerender(<DebatePanel bookId={1} windowId={13} />);

    expect(screen.getByTestId('reply-skeleton')).toBeVisible();
    expect(screen.getByRole('button', { name: 'reply' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'reply' }));
    expect(debateMutate).toHaveBeenCalledOnce();
  });

  it('keeps repeated content optimistic until a new server message arrives, then deduplicates it', () => {
    timelineMessages = [
      {
        messageId: 1,
        sessionId: 3,
        windowId: 13,
        role: 'user',
        content: '같은 주제',
        createdAt: '2026-08-17T00:00:00.000Z',
      },
    ];
    const { rerender } = render(<DebatePanel bookId={1} windowId={13} />);

    fireEvent.click(screen.getByRole('button', { name: 'reply' }));

    expect(screen.getAllByText('같은 주제')).toHaveLength(2);

    const onSuccess = debateMutate.mock.calls[0]?.[1]?.onSuccess;
    act(() => onSuccess?.({ moderation: { decision: 'ALLOW' }, messages: [] }));
    timelineMessages = [
      ...timelineMessages,
      {
        messageId: 2,
        sessionId: 3,
        windowId: 13,
        role: 'user',
        content: '같은 주제',
        createdAt: '2026-08-17T00:00:01.000Z',
      },
    ];
    rerender(<DebatePanel bookId={1} windowId={13} />);

    expect(screen.getAllByText('같은 주제')).toHaveLength(2);
  });

  it('removes the optimistic message when moderation blocks the turn', () => {
    render(<DebatePanel bookId={1} windowId={13} />);
    fireEvent.click(screen.getByRole('button', { name: 'reply' }));

    const onSuccess = debateMutate.mock.calls[0]?.[1]?.onSuccess;
    act(() => onSuccess?.({ moderation: { decision: 'REJECT' }, messages: [] }));

    expect(screen.queryByText('같은 주제')).not.toBeInTheDocument();
  });

  it('removes the optimistic message after an API failure', () => {
    const { rerender } = render(<DebatePanel bookId={1} windowId={13} />);
    fireEvent.click(screen.getByRole('button', { name: 'reply' }));

    debateError = true;
    rerender(<DebatePanel bookId={1} windowId={13} />);

    expect(screen.queryByText('같은 주제')).not.toBeInTheDocument();
  });
});
