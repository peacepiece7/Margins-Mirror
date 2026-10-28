import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGuidedDiscussion } from '../use-guided-discussion';
import { AuthenticatedSessionGuardContext } from '@/lib/authenticated-session-guard';
import { GuidedDiscussionPanel } from './GuidedDiscussionPanel';

vi.mock('@/lib/i18n', () => ({
  translationCatalog: {
    en: {
      reflectionProgressLabel: 'Reflection stages',
      reflectionStepReflect: 'Reflect',
      reflectionStepInterview: 'Interview',
      reflectionStepGuide: 'Guide',
      reflectionStepDiscuss: 'Discuss',
      reflectionStepRefine: 'Refine',
    },
    ko: {
      reflectionProgressLabel: 'Reflection 진행 단계',
      reflectionStepReflect: '기록',
      reflectionStepInterview: '인터뷰',
      reflectionStepGuide: '발제안',
      reflectionStepDiscuss: '토론',
      reflectionStepRefine: '다듬기',
    },
  },
  useI18n: () => ({
    t: (key: string) =>
      ({
        reflectionCharacters: '자',
        reflectionDiscussionAnswerLabel: '토론 답변',
        reflectionDiscussionHistoryEmpty: '현재 질문에 대한 생각부터 편하게 적어보세요.',
        reflectionDiscussionTitle: '발제안을 따라 유연하게 대화해요',
        reflectionDiscussionDescription: '관련성 확인 뒤 다음 동작을 정합니다.',
        reflectionDiscussionErrorTitle: '토론 진행을 저장하지 못했어요',
        reflectionDiscussionErrorDescription: '다시 시도해 주세요.',
        reflectionDiscussionStructureTitle: '이 토론에는 누가 참여하나요?',
        reflectionDiscussionStructureDescription: '기본 토론은 Me + Director로 진행해요.',
        reflectionModerationRedirectTitle: '토론 주제로 다시 이어가 볼게요',
        reflectionModerationRedirectDescription: '이 메시지는 저장되지 않았어요.',
        reflectionModerationRejectTitle: '이 입력은 토론에 사용할 수 없어요',
        reflectionModerationRejectDescription: '내용을 고쳐 주세요.',
        reflectionReload: '다시 불러오기',
        reflectionDiscussionResumeDescription: '저장된 진행 상태에서 이어서 대화합니다.',
        reflectionPreparing: '준비 중',
        reflectionCurrentItemLoading: '현재 토론 항목을 불러오고 있습니다.',
        reflectionMinutes: '분',
        reflectionSensitivity: '민감도',
        reflectionSource: '출처',
        reflectionSavedDiscussionHistory: '저장된 토론 이력',
        reflectionMe: '나',
        reflectionDiscussionPlaceholder: '메모를 적어주세요.',
        reflectionDiscussionComposerHelp: '메모를 저장합니다.',
        reflectionFinishSaving: '마무리 저장 중…',
        reflectionFinishAction: '이 메모로 토론 마치기',
        reflectionNextSaving: '다음 주제 저장 중…',
        reflectionNextAction: '저장하고 다음 주제',
        reflectionRespondSaving: '답변 보내는 중…',
        reflectionRespondAction: '답변 보내기',
        reflectionFinishConfirmationLabel: '토론 마무리 확인',
        reflectionFinishConfirmationTitle: '토론을 마칠까요?',
        reflectionFinishConfirmationDescription: '메모를 저장합니다.',
        reflectionFinishConfirm: '토론 마치기',
        reflectionFinishCancel: '계속 작성하기',
        reflectionDiscussionCompletedTitle: '토론을 마쳤습니다',
        reflectionDiscussionCompletedDescription: 'Reflection을 다듬습니다.',
        reflectionDiscussionRefine: 'Reflection 다듬기',
        reflectionPerspectiveCandidatesLabel: '관점 선택',
        reflectionPerspectiveCandidatesTitle: '만나 볼 관점을 하나 골라 주세요',
        reflectionPerspectiveCandidatesDescription: '하나를 골라 주세요.',
        reflectionDirectorFollowUp: '한 번 더 구체화하기',
        reflectionDirectorPerspective: '다른 관점 만나기',
        reflectionDirectorNext: '다음 주제로 이동',
        reflectionDirectorSummary: '주제 요약',
        reflectionDirectorFinish: '토론 마무리',
        reflectionStageWarmUp: '워밍업',
        reflectionStageInterpretation: '해석',
        reflectionStageExperience: '경험',
        reflectionStageSocialValue: '사회적 가치',
        reflectionStageClosing: '마무리',
      })[key] ?? key,
  }),
}));

const turnMutateAsync = vi.fn();
const turnReset = vi.fn();
const timelineRefetch = vi.fn();
let resolveTurn: (result: any) => void;
let rejectTurn: (error: Error) => void;
let runAvailable = true;
let runStatus = 'ACTIVE';
let runError: Error | null = null;
let runFetching = false;
let turnPending = false;
let turnError: Error | null = null;
let turnVariables: { navigation: 'RESPOND' | 'NEXT' | 'FINISH' } | undefined;
let runCandidates: Array<{ personaId: number; displayName: string; description?: string }> = [];
let selectionRequired: boolean | undefined;
let turnData: {
  moderation?: {
    eventId: number;
    windowId: number;
    decision: 'ALLOW' | 'REDIRECT' | 'REJECT';
    intent: string;
    suggestedQuestion?: string;
  };
} | null = null;
let timelineData: { messages: Array<Record<string, unknown>> } | undefined;
let timelineError: Error | null = null;
let timelineFetching = false;
let timelineSuccess = true;

vi.mock('../queries', () => ({
  useReflectionTimelineForBook: () => ({
    timeline: {
      data: timelineData,
      error: timelineError,
      isError: Boolean(timelineError),
      isFetching: timelineFetching,
      isSuccess: timelineSuccess,
      refetch: timelineRefetch,
    },
  }),
}));

vi.mock('../reflection-loop-queries', () => ({
  useDiscussionRunQuery: () => ({
    data: runAvailable
      ? {
          currentItem: {
            expectedMinutes: 5,
            itemId: 1,
            order: 1,
            priority: 'REQUIRED',
            question: '현재 질문',
            questionId: 2,
            sensitivity: 'LOW',
            sourceExcerpt: '현재 Reflection',
            sourceType: 'REFLECTION',
            stage: 'WARM_UP',
          },
          guideId: 7,
          runId: 9,
          sessionId: 3,
          status: runStatus,
          windowId: 13,
          perspectiveCandidates: runCandidates,
          perspectiveSelectionRequired: selectionRequired ?? runCandidates.length > 0,
        }
      : undefined,
    error: runError,
    isError: Boolean(runError),
    isFetching: runFetching,
    refetch: vi.fn(),
  }),
  useGuidedDiscussionTurnMutation: () => ({
    data: turnData,
    error: turnError,
    isError: Boolean(turnError),
    isPending: turnPending,
    mutateAsync: turnMutateAsync,
    reset: turnReset,
    variables: turnVariables,
  }),
}));

vi.mock('./DeveloperDraftControl', () => ({
  DeveloperDraftControl: ({
    onGenerated,
    target,
  }: {
    onGenerated: (value: string) => void;
    target: string;
  }) => (
    <button onClick={() => onGenerated(`draft-${target}`)} type="button">
      debug-{target}
    </button>
  ),
}));

describe('GuidedDiscussionPanel composer', () => {
  afterEach(cleanup);

  beforeEach(() => {
    turnMutateAsync.mockReset();
    turnMutateAsync.mockImplementation(
      (_input, callbacks) =>
        new Promise((resolve, reject) => {
          resolveTurn = (result) => {
            callbacks.onSuccess(result);
            resolve(result);
          };
          rejectTurn = (error) => {
            callbacks.onError(error);
            reject(error);
          };
        }),
    );
    runAvailable = true;
    runStatus = 'ACTIVE';
    runError = null;
    runFetching = false;
    selectionRequired = undefined;
    turnReset.mockClear();
    turnPending = false;
    turnError = null;
    turnVariables = undefined;
    runCandidates = [];
    turnData = null;
    timelineData = {
      messages: [
        {
          content: '저장된 생각',
          messageId: 1,
          role: 'user',
          windowId: 13,
        },
      ],
    };
    timelineError = null;
    timelineFetching = false;
    timelineSuccess = true;
    timelineRefetch.mockClear();
  });

  it('puts a Discussion draft in the composer without sending a turn', () => {
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'debug-DISCUSSION_TURN' }));

    expect(screen.getByLabelText('토론 답변')).toHaveValue('draft-DISCUSSION_TURN');
    expect(turnMutateAsync).not.toHaveBeenCalled();
  });

  it('keeps the draft until a manual progression request succeeds', () => {
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    const draft = screen.getByLabelText('토론 답변');
    fireEvent.change(draft, { target: { value: '다음 주제로 이어갈 메모' } });

    expect(screen.getByText('13자')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '저장하고 다음 주제' }));

    expect(turnMutateAsync).toHaveBeenCalledWith(
      {
        content: '다음 주제로 이어갈 메모',
        navigation: 'NEXT',
        personaId: undefined,
      },
      expect.any(Object),
    );
    expect(screen.getByTestId('guided-discussion-history')).toHaveTextContent(
      '다음 주제로 이어갈 메모',
    );
    expect(draft).toHaveValue('다음 주제로 이어갈 메모');
    expect(screen.getByTestId('guided-discussion-history')).toHaveAttribute('aria-live', 'polite');
  });

  it('shows the submitted Me message immediately while the Director response is pending', () => {
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('토론 답변'), {
      target: { value: '즉시 보여야 하는 생각' },
    });
    fireEvent.click(screen.getByRole('button', { name: '답변 보내기' }));

    expect(screen.getByTestId('guided-discussion-history')).toHaveTextContent(
      '즉시 보여야 하는 생각',
    );
  });

  it('keeps a repeated Me message optimistic until a new persisted message arrives', async () => {
    timelineData = {
      messages: [
        {
          content: '같은 생각',
          messageId: 1,
          role: 'user',
          windowId: 13,
        },
      ],
    };
    const { rerender } = render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('토론 답변'), {
      target: { value: '같은 생각' },
    });
    fireEvent.click(screen.getByRole('button', { name: '답변 보내기' }));

    expect(
      within(screen.getByTestId('guided-discussion-history')).getAllByText('같은 생각'),
    ).toHaveLength(2);

    await act(async () =>
      resolveTurn({
        runStatus: 'ACTIVE',
        moderation: { decision: 'ALLOW' },
        messages: [],
      }),
    );
    timelineData = {
      messages: [
        {
          content: '같은 생각',
          messageId: 1,
          role: 'user',
          windowId: 13,
        },
        {
          content: '같은 생각',
          messageId: 2,
          role: 'user',
          windowId: 13,
        },
        {
          content: 'Director 응답',
          messageId: 3,
          role: 'assistant',
          windowId: 13,
        },
      ],
    };
    rerender(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    expect(
      within(screen.getByTestId('guided-discussion-history')).getAllByText('같은 생각'),
    ).toHaveLength(2);
    expect(screen.getByText('Director 응답')).toBeVisible();
  });

  it('shows a response skeleton while the turn request is pending', () => {
    turnPending = true;
    turnVariables = { navigation: 'RESPOND' };
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('guided-discussion-reply-skeleton')).toBeVisible();
  });

  it('does not keep an optimistic Me message after blocked moderation', async () => {
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('토론 답변'), {
      target: { value: '저장되면 안 되는 입력' },
    });
    fireEvent.click(screen.getByRole('button', { name: '답변 보내기' }));
    await act(async () =>
      resolveTurn({
        runStatus: 'ACTIVE',
        moderation: {
          eventId: 33,
          windowId: 13,
          decision: 'REJECT',
          intent: 'SPAM',
        },
        messages: [],
      }),
    );

    expect(screen.getByTestId('guided-discussion-history')).not.toHaveTextContent(
      '저장되면 안 되는 입력',
    );
  });

  it('removes a failed optimistic message and keeps its draft retryable', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );
    const draft = screen.getByLabelText('토론 답변');
    fireEvent.change(draft, { target: { value: '실패 뒤 다시 보낼 생각' } });
    fireEvent.click(screen.getByRole('button', { name: '답변 보내기' }));

    turnError = new Error('turn failed');
    await act(async () => rejectTurn(turnError!));
    rerender(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('guided-discussion-history')).not.toHaveTextContent(
      '실패 뒤 다시 보낼 생각',
    );
    expect(draft).toHaveValue('실패 뒤 다시 보낼 생각');
    expect(screen.getByRole('alert')).toHaveTextContent('토론 진행을 저장하지 못했어요');
  });

  it('blocks turn submission until the persisted timeline is loaded', () => {
    timelineData = undefined;
    timelineFetching = true;
    timelineSuccess = false;

    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('토론 답변')).toBeDisabled();
    expect(screen.getByRole('button', { name: '답변 보내기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '저장하고 다음 주제' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이 메모로 토론 마치기' })).toBeDisabled();
  });

  it('allows a failed timeline load to be retried', () => {
    timelineData = undefined;
    timelineError = new Error('timeline failed');
    timelineSuccess = false;

    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));

    expect(timelineRefetch).toHaveBeenCalledOnce();
  });

  it('allows an empty successful timeline response to be retried', () => {
    timelineData = undefined;
    timelineSuccess = true;

    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));

    expect(timelineRefetch).toHaveBeenCalledOnce();
  });

  it('keeps source collapsed and places next progression beside the latest Director response', () => {
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('guided-discussion-source')).not.toHaveAttribute('open');

    const history = screen.getByTestId('guided-discussion-history');
    const nextAction = screen.getByRole('button', { name: '저장하고 다음 주제' });
    const composer = screen.getByTestId('guided-discussion-composer');

    expect(
      history.compareDocumentPosition(nextAction) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      nextAction.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('separates discussion finish from the answer submission composer', () => {
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('guided-discussion-composer')).not.toContainElement(
      screen.getByRole('button', { name: '이 메모로 토론 마치기' }),
    );
    expect(screen.getByTestId('guided-discussion-finish')).toContainElement(
      screen.getByRole('button', { name: '이 메모로 토론 마치기' }),
    );
  });

  it('names the exact manual action that is pending', () => {
    turnPending = true;
    turnVariables = { navigation: 'NEXT' };

    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '다음 주제 저장 중…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '답변 보내기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이 메모로 토론 마치기' })).toBeDisabled();
  });

  it('asks for confirmation before finishing the discussion', async () => {
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('토론 답변'), { target: { value: '마무리 메모' } });
    const finishButton = screen.getByRole('button', { name: '이 메모로 토론 마치기' });
    fireEvent.click(finishButton);

    expect(screen.getByRole('alertdialog', { name: '토론을 마칠까요?' })).toBeVisible();
    expect(turnMutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '계속 작성하기' }));
    await waitFor(() => expect(finishButton).toHaveFocus());

    fireEvent.click(finishButton);
    fireEvent.click(screen.getByRole('button', { name: '토론 마치기' }));

    expect(turnMutateAsync).toHaveBeenCalledWith(
      {
        content: '마무리 메모',
        navigation: 'FINISH',
        personaId: undefined,
      },
      expect.any(Object),
    );
    expect(screen.getByTestId('guided-discussion-history')).toHaveTextContent('마무리 메모');
  });

  it('lets the reader choose one Director-selected perspective', () => {
    runCandidates = [
      { personaId: 41, displayName: '근거를 보는 관점', description: '본문의 근거를 살핍니다.' },
    ];
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('guided-perspective-41'));

    expect(turnMutateAsync).toHaveBeenCalledWith(
      {
        content: '',
        navigation: 'SELECT_PERSPECTIVE',
        personaId: 41,
      },
      expect.any(Object),
    );
  });

  it.each(['', '작성 중인 생각'])(
    'skips a perspective without consuming draft "%s"',
    async (content) => {
      runCandidates = [{ personaId: 41, displayName: '근거를 보는 관점' }];
      render(
        <MemoryRouter>
          <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
        </MemoryRouter>,
      );
      const draft = screen.getByLabelText('토론 답변');
      fireEvent.change(draft, { target: { value: content } });
      fireEvent.click(screen.getByRole('button', { name: 'reflectionPerspectiveSkip' }));
      expect(turnMutateAsync).toHaveBeenCalledWith(
        {
          content: '',
          navigation: 'SKIP_PERSPECTIVE',
          personaId: undefined,
        },
        expect.any(Object),
      );
      expect(screen.getByTestId('guided-discussion-history')).not.toHaveTextContent(
        '작성 중인 생각',
      );
      await act(async () => resolveTurn({ runStatus: 'ACTIVE', messages: [] }));
      expect(draft).toHaveValue(content);
    },
  );

  it('preserves an unsent draft after selecting a perspective', async () => {
    runCandidates = [{ personaId: 41, displayName: '근거를 보는 관점' }];
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );
    const draft = screen.getByLabelText('토론 답변');
    fireEvent.change(draft, { target: { value: '보존할 초안' } });
    fireEvent.click(screen.getByTestId('guided-perspective-41'));
    await act(async () => resolveTurn({ runStatus: 'ACTIVE', messages: [] }));
    expect(draft).toHaveValue('보존할 초안');
    expect(screen.getByTestId('guided-discussion-history')).not.toHaveTextContent('보존할 초안');
  });

  it('keeps a failed finish retryable without clearing the draft', async () => {
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );
    const draft = screen.getByLabelText('토론 답변');
    fireEvent.change(draft, { target: { value: '마무리 초안' } });
    fireEvent.click(screen.getByRole('button', { name: '이 메모로 토론 마치기' }));
    fireEvent.click(screen.getByRole('button', { name: '토론 마치기' }));
    await act(async () => rejectTurn(new Error('finish failed')));
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(screen.getByRole('button', { name: '토론 마치기' })).toBeEnabled();
    expect(draft).toHaveValue('마무리 초안');
    expect(screen.getByTestId('guided-discussion-history')).not.toHaveTextContent('마무리 초안');
    fireEvent.click(screen.getByRole('button', { name: '토론 마치기' }));
    expect(turnMutateAsync).toHaveBeenCalledTimes(2);
    await act(async () => resolveTurn({ runStatus: 'COMPLETED', messages: [] }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(draft).toHaveValue('');
  });

  it.each(['REDIRECT', 'REJECT'])('preserves the draft after %s moderation', async (decision) => {
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );
    const draft = screen.getByLabelText('토론 답변');
    fireEvent.change(draft, { target: { value: '다시 작성할 생각' } });
    fireEvent.click(screen.getByRole('button', { name: '답변 보내기' }));
    await act(async () =>
      resolveTurn({ runStatus: 'ACTIVE', moderation: { decision }, messages: [] }),
    );
    expect(draft).toHaveValue('다시 작성할 생각');
    expect(screen.getByTestId('guided-discussion-history')).not.toHaveTextContent(
      '다시 작성할 생각',
    );
  });

  it('clears the draft only after a successful body submission', async () => {
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );
    const draft = screen.getByLabelText('토론 답변');
    fireEvent.change(draft, { target: { value: '저장할 생각' } });
    fireEvent.click(screen.getByRole('button', { name: '답변 보내기' }));
    expect(draft).toHaveValue('저장할 생각');
    await act(async () => resolveTurn({ runStatus: 'ACTIVE', messages: [] }));
    expect(draft).toHaveValue('');
    expect(screen.getByTestId('guided-discussion-history')).toHaveTextContent('저장할 생각');
  });

  it('guards duplicate calls and invalid perspective IDs inside the workflow', async () => {
    runCandidates = [{ personaId: 41, displayName: '근거를 보는 관점' }];
    const { result } = renderHook(
      () => useGuidedDiscussion({ bookId: 1, runId: 9, personas: [] }),
      { wrapper: MemoryRouter },
    );
    act(() => {
      result.current.perspectives.onSelect(99);
      result.current.composer.onRespond();
    });
    expect(turnMutateAsync).not.toHaveBeenCalled();
    act(() => {
      result.current.perspectives.onSelect(41);
      result.current.perspectives.onSkip();
    });
    expect(turnMutateAsync).toHaveBeenCalledOnce();
    await act(async () => resolveTurn({ runStatus: 'ACTIVE', messages: [] }));
  });

  it.each([
    'missing',
    'fetching',
    'run error',
    'completed',
    'abandoned',
    'timeline error',
    'pending',
  ])('rejects submission inside the workflow when %s', (state) => {
    runAvailable = state !== 'missing';
    runFetching = state === 'fetching';
    runError = state === 'run error' ? new Error('failed') : null;
    runStatus =
      state === 'completed' ? 'COMPLETED' : state === 'abandoned' ? 'ABANDONED' : 'ACTIVE';
    timelineError = state === 'timeline error' ? new Error('failed') : null;
    turnPending = state === 'pending';
    const { result } = renderHook(
      () => useGuidedDiscussion({ bookId: 1, runId: 9, personas: [] }),
      { wrapper: MemoryRouter },
    );
    act(() => result.current.composer.onDraftChange('보내지 않을 내용'));
    act(() => result.current.composer.onRespond());
    expect(turnMutateAsync).not.toHaveBeenCalled();
  });

  it('distinguishes redirect and reject feedback without exposing internal moderation data', () => {
    turnData = {
      moderation: {
        eventId: 30,
        windowId: 13,
        decision: 'REDIRECT',
        intent: 'BENIGN_OFF_TOPIC',
        suggestedQuestion: '이 장면의 선택으로 돌아가 볼까요?',
      },
    };
    const { rerender } = render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('토론 주제로 다시 이어가 볼게요');
    expect(screen.getByRole('alert')).toHaveTextContent('이 장면의 선택으로 돌아가 볼까요?');

    turnData = {
      moderation: {
        eventId: 31,
        windowId: 13,
        decision: 'REJECT',
        intent: 'BYPASS_ATTEMPT',
      },
    };
    rerender(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('이 입력은 토론에 사용할 수 없어요');
    expect(screen.getByRole('alert')).not.toHaveTextContent('BYPASS_ATTEMPT');
  });

  it('explains the Me and Director structure and keeps the blocked draft for retry', () => {
    turnData = {
      moderation: {
        eventId: 32,
        windowId: 13,
        decision: 'REDIRECT',
        intent: 'DISCUSSION_STRUCTURE',
        suggestedQuestion:
          '기본 토론은 Me + Director로 진행하며 필요할 때 다른 관점을 초대할 수 있어요.',
      },
    };
    runCandidates = [
      { personaId: 41, displayName: '근거를 보는 관점', description: '본문 근거를 살핍니다.' },
    ];
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );

    const draft = screen.getByLabelText('토론 답변');
    fireEvent.change(draft, { target: { value: '나말고 다른 사람은 없어요?' } });
    fireEvent.click(screen.getByRole('button', { name: '답변 보내기' }));

    expect(draft).toHaveValue('나말고 다른 사람은 없어요?');
    expect(screen.getByRole('alert')).toHaveTextContent('Me + Director');
    expect(screen.getByTestId('guided-perspective-41')).toBeVisible();
  });
  it('allows skip, but not a body turn, when the server requires selection with no candidates', async () => {
    selectionRequired = true;
    render(
      <MemoryRouter>
        <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: '답변 보내기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'reflectionPerspectiveSkip' }));
    expect(turnMutateAsync).toHaveBeenCalledWith(
      { content: '', navigation: 'SKIP_PERSPECTIVE', personaId: undefined },
      expect.any(Object),
    );
    await act(async () => resolveTurn({ runStatus: 'ACTIVE', messages: [] }));
    expect(screen.queryByTestId('guided-discussion-optimistic-message')).not.toBeInTheDocument();
  });

  it('does not settle a draft or navigate for a superseded authenticated session', async () => {
    let current = true;
    render(
      <AuthenticatedSessionGuardContext.Provider value={() => current}>
        <MemoryRouter>
          <GuidedDiscussionPanel bookId={1} personas={[]} runId={9} />
        </MemoryRouter>
      </AuthenticatedSessionGuardContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText('토론 답변'), {
      target: { value: '이전 session draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: '답변 보내기' }));
    current = false;
    await act(async () => resolveTurn({ runStatus: 'COMPLETED', messages: [] }));
    expect(screen.getByLabelText('토론 답변')).toHaveValue('이전 session draft');
  });
});
