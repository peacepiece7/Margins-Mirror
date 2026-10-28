import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { debatesApi } from '../api';
import { DebatePanel } from './DebatePanel';

const mocks = vi.hoisted(() => ({
  enabled: true,
  pending: false,
  timeline: {} as any,
  debate: vi.fn(),
  debateAll: vi.fn(),
  developerDraft: vi.fn(),
}));
vi.mock('@/lib/feature-flags', () => ({
  get developerDebugEnabled() {
    return mocks.enabled;
  },
}));
vi.mock('@/components/ui/ai-processing-notice', () => ({ AiProcessingNotice: () => null }));
vi.mock('@/components/speech-draft-control', () => ({ SpeechDraftControl: () => null }));
vi.mock('../api', () => ({ debatesApi: { developerDraft: mocks.developerDraft } }));
vi.mock('../queries', () => ({
  useDebateTimelineForBook: () => ({
    sessionId: 3,
    timeline: { data: mocks.timeline, isFetching: false },
  }),
  usePersonasQuery: () => ({
    data: { personas: [{ personaId: 7, name: 'reader', displayName: 'Reader' }] },
  }),
  usePersonaRecommendationsQuery: () => ({ data: { personas: [] } }),
  useDebateMutation: () => ({ mutate: mocks.debate, isPending: mocks.pending, isError: false }),
  useDebateAllMutation: () => ({ mutate: mocks.debateAll, isPending: false, isError: false }),
  useModerationFeedbackMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

function ui(windowId = 11) {
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <DebatePanel bookId={7} windowId={windowId} />
      </I18nProvider>
    </QueryClientProvider>
  );
}
let client: QueryClient;
const input = () => screen.getByTestId('debate-session-message-input');
const generate = () => screen.getByTestId('developer-draft-generate');
function delayedDraft() {
  let resolve!: (value: Awaited<ReturnType<typeof debatesApi.developerDraft>>) => void;
  mocks.developerDraft.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  return async () => {
    await act(async () => {
      resolve({ content: 'Late draft', model: 'test', personas: [] });
    });
  };
}
beforeEach(() => {
  mocks.enabled = true;
  mocks.pending = false;
  vi.clearAllMocks();
  window.localStorage.setItem('margins.locale', 'en');
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  mocks.timeline = {
    windows: [11, 12].map((windowId) => ({
      windowId,
      sessionId: 3,
      windowType: 'debate',
      title: 'Debate: Power',
      personaIds: [7],
      sourceQuestionId: 4,
    })),
    messages: [
      {
        messageId: 1,
        windowId: 11,
        sessionId: 3,
        role: 'assistant',
        content: 'Latest perspective',
      },
      { messageId: 2, windowId: 12, sessionId: 3, role: 'user', content: 'OTHER ROOM SECRET' },
    ],
    questions: [{ questionId: 4, questionText: 'Source question' }],
    insights: [{ questionId: 4, insightType: 'question_answer', content: 'Saved answer' }],
    moderationEvents: [],
  };
});
afterEach(() => {
  cleanup();
  client.clear();
  window.localStorage.clear();
});

describe('web debate developer drafts', () => {
  it('fills the reader composer with bounded current-room context, not a sent turn', async () => {
    mocks.developerDraft.mockResolvedValue({
      content: 'My generated point',
      model: 'resolved-model',
      personas: [{ personaId: 7, displayName: 'Reader' }],
    });
    render(ui());
    fireEvent.change(input(), { target: { value: 'My draft' } });
    fireEvent.click(generate());
    await waitFor(() => expect(input()).toHaveValue('My generated point'));
    expect(mocks.developerDraft).toHaveBeenCalledWith({
      bookId: 7,
      target: 'DISCUSSION_TURN',
      subject: 'Power',
      context: expect.stringContaining('Latest perspective'),
    });
    const context = mocks.developerDraft.mock.calls[0][0].context;
    expect(context).toContain('My draft');
    expect(context).toContain('Source question');
    expect(context).toContain('Saved answer');
    expect(context).not.toContain('OTHER ROOM SECRET');
    expect(screen.getByText('resolved-model')).toBeVisible();
    expect(mocks.debate).not.toHaveBeenCalled();
    expect(mocks.debateAll).not.toHaveBeenCalled();
  });

  it('prevents duplicate generation and preserves manual edits made during generation', async () => {
    const finish = delayedDraft();
    render(ui());
    fireEvent.click(generate());
    await waitFor(() => expect(generate()).toBeDisabled());
    fireEvent.click(generate());
    expect(mocks.developerDraft).toHaveBeenCalledOnce();
    fireEvent.change(input(), { target: { value: 'Typed while waiting' } });
    await finish();
    expect(input()).toHaveValue('Typed while waiting');
  });

  it.each(['room', 'history', 'send', 'all', 'close'])(
    'discards a late result after %s changes',
    async (transition) => {
      const finish = delayedDraft();
      const view = render(ui());
      fireEvent.change(input(), { target: { value: 'Existing draft' } });
      fireEvent.click(generate());
      await waitFor(() => expect(generate()).toBeDisabled());
      if (transition === 'room') view.rerender(ui(12));
      if (transition === 'history') {
        mocks.timeline = {
          ...mocks.timeline,
          messages: [{ ...mocks.timeline.messages[0], content: 'Edited history' }],
        };
        view.rerender(ui());
      }
      if (transition === 'send') fireEvent.click(screen.getByTestId('debate-session-submit'));
      if (transition === 'all') fireEvent.click(screen.getByTestId('debate-all-submit'));
      if (transition === 'close') view.unmount();
      await finish();
      if (transition !== 'close')
        expect(input()).toHaveValue(transition === 'room' ? '' : 'Existing draft');
    },
  );

  it('preserves input on failure and permits an explicit retry', async () => {
    mocks.developerDraft
      .mockRejectedValueOnce(new Error('upstream'))
      .mockResolvedValueOnce({ content: 'Retry draft', model: 'test', personas: [] });
    render(ui());
    fireEvent.change(input(), { target: { value: 'Keep me' } });
    fireEvent.click(generate());
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be generated');
    expect(input()).toHaveValue('Keep me');
    fireEvent.click(generate());
    await waitFor(() => expect(input()).toHaveValue('Retry draft'));
  });

  it('disables generation during a turn or for a missing room, and hides it with debug off', () => {
    mocks.pending = true;
    const view = render(ui());
    expect(generate()).toBeDisabled();
    mocks.pending = false;
    view.rerender(ui(99));
    expect(generate()).toBeDisabled();
    mocks.enabled = false;
    view.rerender(ui());
    expect(screen.queryByTestId('developer-draft-generate')).not.toBeInTheDocument();
    expect(mocks.developerDraft).not.toHaveBeenCalled();
  });
});
