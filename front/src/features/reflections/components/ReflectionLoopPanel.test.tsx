import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReflectionLoopResponse } from '@/types/api/reflection-loop';
import { I18nProvider } from '@/lib/i18n';
import { ApiRequestError } from '@/lib/api-client';

import { ReflectionLoopPanel } from './ReflectionLoopPanel';

const saveMutate = vi.fn();
const startInterviewMutate = vi.fn();
let reflectionSessionId: number | undefined = 3;
let reflectionData: ReflectionLoopResponse = {
  activeInterviewId: 17,
  currentRevision: {
    content: '저장된 생각',
    revisionId: 21,
    revisionSource: 'INITIAL',
    version: 1,
  },
  reflectionId: 11,
  revisions: [],
  sessionId: 3,
  visibility: 'PRIVATE' as const,
};
let reflectionQuery: {
  data: ReflectionLoopResponse | undefined;
  isFetching: boolean;
  error: ApiRequestError | null;
  isError: boolean;
  refetch: ReturnType<typeof vi.fn>;
} = {
  data: reflectionData,
  isFetching: false,
  error: null as ApiRequestError | null,
  isError: false,
  refetch: vi.fn(),
};

vi.mock('../queries', () => ({
  useReflectionSessionForBook: () => ({
    sessionId: reflectionSessionId,
    sessions: { error: null, isError: false, isLoading: false, refetch: vi.fn() },
  }),
  useReflectionTimelineForBook: () => ({
    sessionId: 3,
    sessions: { isLoading: false },
    timeline: { data: { insights: [] }, isFetching: false },
  }),
}));

vi.mock('../reflection-loop-queries', () => ({
  useSessionReflectionQuery: () =>
    reflectionQuery.data === undefined
      ? reflectionQuery
      : { ...reflectionQuery, data: reflectionData },
  useSavePrimaryReflectionMutation: () => ({
    error: null,
    isError: false,
    isPending: false,
    mutate: saveMutate,
    reset: vi.fn(),
  }),
  useStartReflectionInterviewMutation: () => ({
    error: null,
    isPending: false,
    mutate: startInterviewMutate,
  }),
}));

function LocationProbe() {
  return <output data-testid="location-probe">{useLocation().pathname}</output>;
}

function renderPanel() {
  rtlRender(
    <I18nProvider>
      <MemoryRouter initialEntries={['/book/1/reflection']}>
        <ReflectionLoopPanel bookId={1} />
        <LocationProbe />
      </MemoryRouter>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('ReflectionLoopPanel draft state', () => {
  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'ko');
    saveMutate.mockClear();
    startInterviewMutate.mockClear();
    reflectionSessionId = 3;
    reflectionData = {
      activeInterviewId: 17,
      currentRevision: {
        content: '저장된 생각',
        revisionId: 21,
        revisionSource: 'INITIAL',
        version: 1,
      },
      reflectionId: 11,
      revisions: [],
      sessionId: 3,
      visibility: 'PRIVATE',
    };
    reflectionQuery = {
      data: reflectionData,
      isFetching: false,
      error: null,
      isError: false,
      refetch: vi.fn(),
    };
  });

  it('prevents duplicate revisions and blocks Interview navigation until edits are saved', async () => {
    renderPanel();

    const editor = await screen.findByLabelText('Reflection 본문');
    const save = screen.getByTestId('primary-reflection-save');
    const interview = screen.getByTestId('reflection-start-interview');

    await waitFor(() => expect(editor).toHaveValue('저장된 생각'));
    expect(save).toBeDisabled();
    expect(interview).toBeEnabled();
    expect(screen.getByTestId('reflection-save-status')).toHaveTextContent(
      '모든 변경 사항을 저장했습니다.',
    );

    fireEvent.change(editor, { target: { value: '  수정한 생각  ' } });

    expect(save).toBeEnabled();
    expect(interview).toBeDisabled();
    expect(screen.getByTestId('reflection-save-status')).toHaveTextContent(
      '저장하지 않은 변경 사항',
    );

    fireEvent.click(save);
    expect(saveMutate).toHaveBeenCalledWith({
      content: '수정한 생각',
      title: 'Reflection',
      visibility: 'PRIVATE',
    });
  });

  it('recovers an active run from its pinned Guide after a new current Guide exists', async () => {
    reflectionData = {
      ...reflectionData,
      guideId: 31,
      runId: 41,
      runStatus: 'ACTIVE',
    };
    renderPanel();

    const resume = await screen.findByRole('button', { name: '토론 이어가기' });
    expect(screen.getByTestId('reflection-run-recovery')).toHaveTextContent('원래 발제안 버전');

    fireEvent.click(resume);

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/book/1/reflection/discuss/41');
  });

  it('recovers a completed run in Refine while keeping the new current Guide projection', async () => {
    reflectionData = {
      ...reflectionData,
      guideId: 32,
      runId: 41,
      runStatus: 'COMPLETED',
    };
    renderPanel();

    const resume = await screen.findByRole('button', { name: 'Reflection 다듬기' });
    expect(screen.getByTestId('reflection-run-recovery')).toHaveTextContent(
      '처음 시작한 발제안 버전',
    );

    fireEvent.click(resume);

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/book/1/reflection/refine/41');
  });

  it('shows a safe empty-state message and keeps an empty editor for a missing Reflection', async () => {
    const privateMessage = 'private server detail that must not be rendered';
    const error = new ApiRequestError(
      'COMMON_NOT_FOUND',
      404,
      [],
      'request-123',
      undefined,
      privateMessage,
    );
    reflectionQuery = {
      data: undefined,
      isFetching: false,
      error,
      isError: true,
      refetch: vi.fn(),
    };

    renderPanel();

    expect(await screen.findByText('아직 작성한 Reflection이 없습니다')).toBeInTheDocument();
    expect(screen.getByText('지금 떠오르는 생각을 먼저 적어 저장해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText(privateMessage)).not.toBeInTheDocument();
    expect(screen.getByTestId('primary-reflection-content')).toHaveValue('');
    expect(screen.getByTestId('primary-reflection-save')).toBeDisabled();
  });

  it('does not prepare a reading session until the reader submits a Reflection', async () => {
    reflectionSessionId = undefined;
    reflectionQuery = {
      data: undefined,
      isFetching: false,
      error: null,
      isError: false,
      refetch: vi.fn(),
    };

    renderPanel();

    expect(saveMutate).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText('Reflection 본문'), {
      target: { value: '처음 남기는 생각' },
    });
    fireEvent.click(screen.getByTestId('primary-reflection-save'));

    expect(saveMutate).toHaveBeenCalledOnce();
    expect(saveMutate).toHaveBeenCalledWith({
      content: '처음 남기는 생각',
      title: 'Reflection',
      visibility: 'PRIVATE',
    });
  });
});
