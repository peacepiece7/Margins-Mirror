import { cleanup, fireEvent, render as rtlRender, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DiscussionGuideProjection,
  DiscussionGuideProjectionResponse,
  DiscussionGuideResponse,
} from '@/types/api/reflection-loop';
import { I18nProvider } from '@/lib/i18n';

import { DiscussionGuidePanel } from './DiscussionGuidePanel';

const createRunMutate = vi.fn();
const editMutate = vi.fn();
const regenerateMutate = vi.fn();
const exportMutate = vi.fn();
let guideData: DiscussionGuideResponse;

function currentGuide(): DiscussionGuideResponse {
  return {
    audienceMode: 'SELF_AI',
    current: true,
    currentGuideId: 7,
    depth: 'SIMPLE',
    disclosureMode: 'PRIVATE_CONTEXT',
    facilitationLevel: 'BEGINNER',
    goal: '처음 목표',
    guideId: 7,
    guideVersion: 1,
    interviewId: 5,
    issues: ['첫 논점', '둘째 논점'],
    items: [
      {
        expectedMinutes: 4,
        followUps: ['조금 더 말해 볼까요?'],
        intent: '시작 의도',
        itemId: 101,
        order: 1,
        priority: 'REQUIRED',
        privateSource: true,
        question: '첫 질문',
        questionId: 201,
        sensitivity: 'LOW',
        skippable: true,
        sourceExcerpt: null,
        sourceRefId: 301,
        sourceType: 'ANSWER',
        stage: 'WARM_UP',
      },
      ...['INTERPRETATION', 'EXPERIENCE', 'SOCIAL_VALUE', 'CLOSING'].map((stage, index) => ({
        expectedMinutes: 4,
        followUps: [],
        intent: `${stage} 의도`,
        itemId: 102 + index,
        order: 2 + index,
        priority: 'REQUIRED' as const,
        privateSource: false,
        question: `${stage} 질문`,
        questionId: 202 + index,
        sensitivity: 'LOW' as const,
        skippable: true,
        sourceExcerpt: '현재 Reflection',
        sourceRefId: 401,
        sourceType: 'REFLECTION',
        stage,
      })),
    ],
    origin: 'GENERATED',
    purpose: 'THOUGHT_EXPANSION',
    reflectionId: 3,
    runId: null,
    sessionId: 4,
    status: 'READY',
    targetMinutes: 20,
  };
}

function guideProjection(projection: DiscussionGuideProjection): DiscussionGuideProjectionResponse {
  const common = {
    bookAuthor: 'Test Author',
    bookTitle: 'Test Book',
    current: guideData.current,
    goal: guideData.goal,
    guideId: guideData.guideId,
    guideVersion: guideData.guideVersion,
    issues: guideData.issues,
  };
  if (projection === 'PARTICIPANT') {
    return {
      ...common,
      items: guideData.items.map((item) => ({
        order: item.order,
        priority: item.priority,
        question: item.question,
        stage: item.stage,
      })),
      projection,
    };
  }
  return {
    ...common,
    items: guideData.items.map((item) => ({
      expectedMinutes: item.expectedMinutes,
      followUps: item.followUps,
      intent: item.intent,
      order: item.order,
      priority: item.priority,
      privateSource: Boolean(item.privateSource),
      question: item.question,
      sensitivity: item.sensitivity,
      skippable: item.skippable,
      sourceExcerpt: item.privateSource ? null : item.sourceExcerpt,
      sourceLabel: item.privateSource ? '비공개 인터뷰 답변' : '현재 Reflection',
      sourceType: item.sourceType,
      stage: item.stage,
    })),
    projection,
    targetMinutes: guideData.targetMinutes,
  };
}

vi.mock('../reflection-loop-queries', () => ({
  useDiscussionGuideQuery: () => ({
    data: guideData,
    error: null,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useDiscussionGuideVersionsQuery: () => ({
    data: {
      currentGuideId: 7,
      interviewId: 5,
      versions: [
        {
          current: guideData.current,
          guideId: guideData.guideId,
          guideVersion: guideData.guideVersion,
          hasRun: Boolean(guideData.runId),
          origin: guideData.origin,
          status: guideData.status,
        },
      ],
    },
    error: null,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useDiscussionGuideProjectionQuery: (_guideId: number, projection: DiscussionGuideProjection) => ({
    data: guideProjection(projection),
    error: null,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useDiscussionGuideMarkdownExportMutation: () => ({
    error: null,
    isPending: false,
    mutate: exportMutate,
  }),
  useCreateDiscussionRunMutation: () => ({
    error: null,
    isPending: false,
    mutate: createRunMutate,
  }),
  useEditDiscussionGuideMutation: () => ({
    error: null,
    isPending: false,
    mutate: editMutate,
  }),
  useRegenerateDiscussionGuideMutation: () => ({
    error: null,
    isPending: false,
    mutate: regenerateMutate,
  }),
}));

describe('DiscussionGuidePanel versions', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'ko');
    guideData = currentGuide();
    createRunMutate.mockClear();
    editMutate.mockClear();
    regenerateMutate.mockClear();
    exportMutate.mockClear();
  });

  function render(ui: ReactNode) {
    return rtlRender(<I18nProvider>{ui}</I18nProvider>);
  }

  it('redacts private answer text and sends a complete immutable edit payload', () => {
    render(
      <MemoryRouter>
        <DiscussionGuidePanel bookId={1} guideId={7} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/비공개 인터뷰 답변을 AI 생성 문맥으로만 참고/)).toBeVisible();
    expect(screen.queryByText('민감 답변 원문')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('discussion-guide-edit'));
    fireEvent.change(screen.getByLabelText('토론 목표'), {
      target: { value: '편집한 목표' },
    });
    const firstItem = screen.getAllByTestId('discussion-guide-item')[0];
    fireEvent.change(within(firstItem).getByLabelText('질문'), {
      target: { value: '편집한 첫 질문' },
    });
    fireEvent.change(within(firstItem).getByLabelText('후속 질문 1'), {
      target: { value: '편집한 후속 질문' },
    });
    fireEvent.click(within(firstItem).getByRole('button', { name: '1번 질문 후속 질문 추가' }));
    fireEvent.change(within(firstItem).getByLabelText('후속 질문 2'), {
      target: { value: '새 후속 질문' },
    });
    fireEvent.click(screen.getByTestId('discussion-guide-save-version'));

    expect(editMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 1,
        goal: '편집한 목표',
        issues: ['첫 논점', '둘째 논점'],
        items: expect.arrayContaining([
          expect.objectContaining({
            itemId: 101,
            question: '편집한 첫 질문',
            followUps: ['편집한 후속 질문', '새 후속 질문'],
          }),
        ]),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('confirms regeneration with the exact persisted brief', () => {
    render(
      <MemoryRouter>
        <DiscussionGuidePanel bookId={1} guideId={7} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('discussion-guide-regenerate'));
    fireEvent.click(screen.getByRole('button', { name: '새 version 만들기' }));

    expect(regenerateMutate).toHaveBeenCalledWith(
      {
        expectedVersion: 1,
        brief: {
          purpose: 'THOUGHT_EXPANSION',
          facilitationLevel: 'BEGINNER',
          audienceMode: 'SELF_AI',
          targetMinutes: 20,
          disclosureMode: 'PRIVATE_CONTEXT',
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('keeps an archive version read-only and prevents a new run', () => {
    guideData = {
      ...currentGuide(),
      current: false,
      currentGuideId: 8,
      guideId: 7,
      status: 'ARCHIVED',
    };
    render(
      <MemoryRouter>
        <DiscussionGuidePanel bookId={1} guideId={7} />
      </MemoryRouter>,
    );

    expect(screen.getByText('읽기 전용으로 보관된 version입니다')).toBeVisible();
    expect(screen.queryByTestId('discussion-guide-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('discussion-guide-regenerate')).not.toBeInTheDocument();
    expect(screen.getByTestId('discussion-start-run')).toBeDisabled();
  });

  it('switches to a minimal participant preview and exports only that projection', () => {
    render(
      <MemoryRouter>
        <DiscussionGuidePanel bookId={1} guideId={7} />
      </MemoryRouter>,
    );

    fireEvent.mouseDown(screen.getByTestId('discussion-guide-participant-tab'), {
      button: 0,
      ctrlKey: false,
    });

    const preview = screen.getByTestId('discussion-guide-participant-preview');
    expect(within(preview).getAllByTestId('discussion-guide-projection-item')).toHaveLength(5);
    expect(within(preview).queryByText('시작 의도')).not.toBeInTheDocument();
    expect(within(preview).queryByText(/비공개 인터뷰 답변/)).not.toBeInTheDocument();
    expect(screen.getByTestId('discussion-guide-edit')).toBeDisabled();
    expect(screen.getByTestId('discussion-guide-regenerate')).toBeDisabled();

    fireEvent.click(screen.getByTestId('discussion-guide-download-markdown'));
    expect(exportMutate).toHaveBeenCalledWith(
      'PARTICIPANT',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
