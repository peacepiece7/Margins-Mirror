import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DebatePanel } from './DebatePanel';

vi.mock('@/components/ui/ai-processing-notice', () => ({
  AiProcessingNotice: () => null,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const mocks = vi.hoisted(() => ({
  debate: vi.fn(),
  debateAll: vi.fn(),
  moderationFeedback: vi.fn(),
  debatePending: false,
  debateError: false,
  timeline: {
    data: undefined as any,
    isFetching: false,
  },
  personas: { data: undefined as any },
  recommendations: { data: undefined as any },
}));

vi.mock('../queries', () => ({
  useDebateAllMutation: () => ({
    isError: false,
    isPending: false,
    mutate: mocks.debateAll,
  }),
  useDebateMutation: () => ({
    isError: mocks.debateError,
    isPending: mocks.debatePending,
    mutate: mocks.debate,
  }),
  useDebateTimelineForBook: () => ({ sessionId: 3, timeline: mocks.timeline }),
  useModerationFeedbackMutation: () => ({ isPending: false, mutate: mocks.moderationFeedback }),
  usePersonaRecommendationsQuery: () => mocks.recommendations,
  usePersonasQuery: () => mocks.personas,
}));

vi.mock('./DebatePage', () => ({
  DebatePage: ({
    loading,
    messages,
    onAllReplies,
    onPersonaReply,
    selectedPersonas,
    showReplySkeleton,
  }: {
    loading: boolean;
    messages: Array<{ id: string; content: string }>;
    onAllReplies: () => void;
    onPersonaReply: (personaId: number) => void;
    selectedPersonas: Array<{ personaId: number }>;
    showReplySkeleton: boolean;
  }) => (
    <div>
      <output data-testid="selected-persona-ids">
        {selectedPersonas.map((persona) => persona.personaId).join(',')}
      </output>
      <div data-testid="messages">
        {messages.map((message) => (
          <span key={message.id}>{message.content}</span>
        ))}
      </div>
      {showReplySkeleton ? <div data-testid="reply-skeleton" /> : null}
      <button
        disabled={loading}
        onClick={() => onPersonaReply(selectedPersonas[0]?.personaId ?? 7)}
        type="button"
      >
        reply
      </button>
      <button onClick={() => onPersonaReply(selectedPersonas[0]?.personaId ?? 0)} type="button">
        first reply
      </button>
      <button onClick={onAllReplies} type="button">
        all replies
      </button>
    </div>
  ),
}));

function timelineWindow(
  windowId: number,
  personaIds?: number[],
  title = 'Debate: persisted selection',
) {
  return {
    windowId,
    sessionId: 3,
    windowType: 'debate',
    title,
    status: 'open',
    personaIds,
  };
}

const personas = {
  data: {
    personas: [
      { personaId: 10, name: 'recommended', displayName: 'Recommended' },
      { personaId: 20, name: 'persisted-one', displayName: 'Persisted One' },
      { personaId: 21, name: 'persisted-two', displayName: 'Persisted Two' },
    ],
  },
};

function setTimeline(
  windowId: number,
  personaIds: number[] | undefined,
  messages: any[] = [],
  title?: string,
) {
  mocks.timeline.data = {
    windows: [timelineWindow(windowId, personaIds, title)],
    messages,
    moderationEvents: [],
    questions: [],
    insights: [],
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.debatePending = false;
  mocks.debateError = false;
  mocks.timeline.data = undefined;
  mocks.timeline.isFetching = false;
  window.localStorage.clear();
});

describe('DebatePanel persisted persona orchestration', () => {
  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'en');
    mocks.personas = personas;
    mocks.recommendations = { data: { personas: [personas.data.personas[0]] } };
    setTimeline(11, [20]);
  });

  it('uses an out-of-recommendation persisted selection for first turn and debate all', () => {
    render(<DebatePanel bookId={7} windowId={11} />);

    expect(screen.getByTestId('selected-persona-ids')).toHaveTextContent('20');
    fireEvent.click(screen.getByRole('button', { name: 'first reply' }));
    fireEvent.click(screen.getByRole('button', { name: 'all replies' }));

    expect(mocks.debate).toHaveBeenCalledWith(
      { windowId: 11, personaId: 20, content: 'persisted selection' },
      expect.any(Object),
    );
    expect(mocks.debateAll).toHaveBeenCalledWith(
      { windowId: 11, content: 'persisted selection', personaIds: [20] },
      expect.any(Object),
    );
  });

  it('keeps persisted selection after timeline refresh and falls back for legacy rooms with 0, 1, or 2 recommendations', () => {
    const view = render(<DebatePanel bookId={7} windowId={11} />);

    setTimeline(11, [21]);
    view.rerender(<DebatePanel bookId={7} windowId={11} />);
    expect(screen.getByTestId('selected-persona-ids')).toHaveTextContent('21');
    cleanup();

    for (const recommended of [[], [10], [10, 20]]) {
      setTimeline(11, undefined);
      mocks.recommendations = {
        data: {
          personas: recommended.map((id) => personas.data.personas.find((p) => p.personaId === id)),
        },
      };
      render(<DebatePanel bookId={7} windowId={11} />);
      expect(screen.getByTestId('selected-persona-ids')).toHaveTextContent(recommended.join(','));
      cleanup();
    }
  });
});

describe('DebatePanel optimistic message lifecycle', () => {
  beforeEach(() => {
    mocks.personas = {
      data: { personas: [{ personaId: 7, displayName: 'Reader', name: 'reader' }] },
    };
    mocks.recommendations = {
      data: { personas: [{ personaId: 7, displayName: 'Reader', name: 'reader' }] },
    };
    setTimeline(13, [7], [], 'Debate: 같은 주제');
  });

  it('shows an optimistic reader message on an empty timeline and blocks resubmission while pending', () => {
    const { rerender } = render(<DebatePanel bookId={1} windowId={13} />);

    fireEvent.click(screen.getByRole('button', { name: 'reply' }));

    expect(screen.getByText('같은 주제')).toBeVisible();
    expect(mocks.debate).toHaveBeenCalledOnce();

    mocks.debatePending = true;
    rerender(<DebatePanel bookId={1} windowId={13} />);

    expect(screen.getByTestId('reply-skeleton')).toBeVisible();
    expect(screen.getByRole('button', { name: 'reply' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'reply' }));
    expect(mocks.debate).toHaveBeenCalledOnce();
  });

  it('keeps repeated content optimistic until a new server message arrives, then deduplicates it', () => {
    const initialMessage = {
      messageId: 1,
      sessionId: 3,
      windowId: 13,
      role: 'user',
      content: '같은 주제',
      createdAt: '2026-08-17T00:00:00.000Z',
    };
    setTimeline(13, [7], [initialMessage], 'Debate: 같은 주제');
    const { rerender } = render(<DebatePanel bookId={1} windowId={13} />);

    fireEvent.click(screen.getByRole('button', { name: 'reply' }));
    expect(screen.getAllByText('같은 주제')).toHaveLength(2);

    const onSuccess = mocks.debate.mock.calls[0]?.[1]?.onSuccess;
    act(() => onSuccess?.({ moderation: { decision: 'ALLOW' }, messages: [] }));
    setTimeline(
      13,
      [7],
      [
        initialMessage,
        {
          messageId: 2,
          sessionId: 3,
          windowId: 13,
          role: 'user',
          content: '같은 주제',
          createdAt: '2026-08-17T00:00:01.000Z',
        },
      ],
      'Debate: 같은 주제',
    );
    rerender(<DebatePanel bookId={1} windowId={13} />);

    expect(screen.getAllByText('같은 주제')).toHaveLength(2);
  });

  it('removes the optimistic message when moderation blocks the turn', () => {
    render(<DebatePanel bookId={1} windowId={13} />);
    fireEvent.click(screen.getByRole('button', { name: 'reply' }));

    const onSuccess = mocks.debate.mock.calls[0]?.[1]?.onSuccess;
    act(() => onSuccess?.({ moderation: { decision: 'REJECT' }, messages: [] }));

    expect(screen.queryByText('같은 주제')).not.toBeInTheDocument();
  });

  it('removes the optimistic message after an API failure', () => {
    const { rerender } = render(<DebatePanel bookId={1} windowId={13} />);
    fireEvent.click(screen.getByRole('button', { name: 'reply' }));

    mocks.debateError = true;
    rerender(<DebatePanel bookId={1} windowId={13} />);

    expect(screen.queryByText('같은 주제')).not.toBeInTheDocument();
  });
});
