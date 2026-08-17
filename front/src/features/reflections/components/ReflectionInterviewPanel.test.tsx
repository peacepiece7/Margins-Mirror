import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/lib/api-client';
import { I18nProvider } from '@/lib/i18n';

import { ReflectionInterviewPanel } from './ReflectionInterviewPanel';

const createGuideMutate = vi.fn();
const createGuideReset = vi.fn();
const updateAnswerMutate = vi.fn();
let currentQuestion: Record<string, unknown> | null = null;
let currentAnswers: Array<Record<string, unknown>> = [];
let createGuideError: unknown = null;
let createGuidePending = false;

vi.mock('../queries', () => ({
  useReflectionTimelineForBook: () => ({
    timeline: {
      data: {
        insights: [
          {
            insightId: 11,
            insightType: 'reflection',
            content: '현재 Reflection',
          },
        ],
      },
      error: null,
      isFetching: false,
    },
  }),
}));

vi.mock('../reflection-loop-queries', () => ({
  useReflectionLoopQuery: () => ({
    data: { activeInterviewId: 12, reflectionId: 11 },
    error: null,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }),
  useStartReflectionInterviewMutation: () => ({
    error: null,
    isError: false,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
  }),
  useReflectionInterviewQuery: () => ({
    data: {
      answeredCount: 3,
      canGenerateGuide: true,
      coverage: [],
      currentQuestion,
      answers: currentAnswers,
      generatedCount: 3,
      guideId: null,
      interviewId: 12,
      maxReached: false,
      maximumQuestions: 7,
      minimumAnswers: 3,
      reflectionId: 11,
      skippedCount: 0,
      sourceRevisionId: 1,
      status: 'ACTIVE',
      targetAnswers: 5,
    },
    error: null,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useInterviewResponseMutation: () => ({
    error: null,
    isPending: false,
    mutate: vi.fn(),
  }),
  useUpdateInterviewAnswerMutation: () => ({
    error: null,
    isPending: false,
    mutate: updateAnswerMutate,
  }),
  useContinueReflectionInterviewMutation: () => ({
    error: null,
    isPending: false,
    mutate: vi.fn(),
  }),
  useCreateDiscussionGuideMutation: () => ({
    error: createGuideError,
    isPending: createGuidePending,
    mutate: createGuideMutate,
    reset: createGuideReset,
  }),
}));

describe('ReflectionInterviewPanel Guide brief', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'ko');
    createGuideMutate.mockClear();
    createGuideReset.mockClear();
    updateAnswerMutate.mockClear();
    currentQuestion = null;
    currentAnswers = [];
    createGuideError = null;
    createGuidePending = false;
  });

  function render(ui: ReactNode) {
    return rtlRender(<I18nProvider>{ui}</I18nProvider>);
  }

  it('sends the chosen brief only when the reader creates a Guide', () => {
    render(
      <MemoryRouter>
        <ReflectionInterviewPanel bookId={1} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('discussion-guide-brief')).toBeVisible();
    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.click(screen.getByLabelText(/토론 준비/));
    fireEvent.click(screen.getByLabelText(/소그룹/));
    fireEvent.click(screen.getByLabelText('20분'));
    fireEvent.click(screen.getByLabelText(/비공개 답변 제외/));
    fireEvent.click(screen.getByTestId('reflection-create-guide'));

    expect(createGuideMutate).toHaveBeenCalledWith(
      {
        purpose: 'DISCUSSION_PREP',
        audienceMode: 'SMALL_GROUP',
        targetMinutes: 20,
        disclosureMode: 'REFLECTION_ONLY',
        facilitationLevel: 'BEGINNER',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('shows the immutable Book Knowledge source state for the current question', () => {
    currentQuestion = {
      coverageArea: 'SOCIAL_VALUE',
      question: '책의 배경을 오늘과 연결하면 무엇이 보이나요?',
      questionId: 21,
      sensitivity: 'LOW',
      sourceExcerpt: '책 배경 요약',
      sourceFallback: true,
      sourceRefId: 31,
      sourceStale: true,
      sourceType: 'BOOK_KNOWLEDGE',
      sourceVersion: 'book-knowledge-v1',
      status: 'active',
    };

    render(
      <MemoryRouter>
        <ReflectionInterviewPanel bookId={1} />
      </MemoryRouter>,
    );

    expect(screen.getByText('book-knowledge-v1')).toBeVisible();
    expect(screen.getByText('업데이트 필요')).toBeVisible();
    expect(screen.getByText('임시 분석')).toBeVisible();
    expect(screen.getByText(/근거: 책 배경 요약/)).toBeVisible();
    expect(screen.getByRole('link', { name: '원문 revision 보기' })).toHaveAttribute(
      'href',
      '/book/1/reflection#reflection-revision-1',
    );
  });

  it('offers optimistic wording edits for saved interview answers', () => {
    currentAnswers = [
      {
        answerRevisionId: 41,
        content: '처음 적은 답변',
        question: '이 장면을 어떻게 읽었나요?',
        questionId: 31,
        responseMode: 'ANSWER',
        version: 2,
      },
    ];

    render(
      <MemoryRouter>
        <ReflectionInterviewPanel bookId={1} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /답변 수정$/ }));
    fireEvent.change(screen.getByLabelText('이 장면을 어떻게 읽었나요? 답변 수정'), {
      target: { value: '표현을 다듬은 답변' },
    });
    fireEvent.click(screen.getByRole('button', { name: '표현만 다듬기' }));

    expect(updateAnswerMutate).toHaveBeenCalledWith(
      {
        content: '표현을 다듬은 답변',
        expectedAnswerVersion: 2,
        questionId: 31,
        revisionKind: 'WORDING_ONLY',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('keeps the chosen brief and retries only the failed Guide creation', () => {
    const view = render(
      <MemoryRouter>
        <ReflectionInterviewPanel bookId={1} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.click(screen.getByLabelText(/토론 준비/));
    fireEvent.click(screen.getByLabelText(/소그룹/));
    fireEvent.click(screen.getByLabelText('20분'));
    fireEvent.click(screen.getByLabelText(/비공개 답변 제외/));

    createGuideError = new ApiRequestError('COMMON_UPSTREAM_ERROR', 502, [], 'guide-request-id');
    view.rerender(
      <I18nProvider>
        <MemoryRouter>
          <ReflectionInterviewPanel bookId={1} />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByText('발제안을 만들지 못했어요')).toBeVisible();
    expect(
      screen.getByText('저장한 Reflection과 인터뷰 답변은 그대로예요. 잠시 후 다시 시도해 주세요.'),
    ).toBeVisible();
    expect(screen.getByText('요청 ID: guide-request-id')).toBeVisible();
    expect(screen.queryByText('인터뷰 진행을 이어가지 못했어요')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/토론 준비/)).toBeChecked();
    expect(screen.getByLabelText(/소그룹/)).toBeChecked();
    expect(screen.getByLabelText('20분')).toBeChecked();
    expect(screen.getByLabelText(/비공개 답변 제외/)).toBeChecked();
    expect(screen.getByLabelText(/초심자/)).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: '발제안 다시 만들기' }));

    expect(createGuideReset).toHaveBeenCalledOnce();
    expect(createGuideMutate).toHaveBeenCalledWith(
      {
        purpose: 'DISCUSSION_PREP',
        audienceMode: 'SMALL_GROUP',
        targetMinutes: 20,
        disclosureMode: 'REFLECTION_ONLY',
        facilitationLevel: 'BEGINNER',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('prevents duplicate Guide creation while one request is pending', () => {
    createGuidePending = true;

    render(
      <MemoryRouter>
        <ReflectionInterviewPanel bookId={1} />
      </MemoryRouter>,
    );

    const createButton = screen.getByTestId('reflection-create-guide');
    expect(createButton).toBeDisabled();
    fireEvent.click(createButton);
    expect(createGuideMutate).not.toHaveBeenCalled();
  });
});
