import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReflectionLoopResponse } from '@/types/api/reflection-loop';
import { I18nProvider } from '@/lib/i18n';
import { ApiRequestError } from '@/lib/api-client';

import { ReflectionLoopPanel } from './ReflectionLoopPanel';

const ensureSessionMutate = vi.fn();
const saveMutate = vi.fn();
const startInterviewMutate = vi.fn();
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
  useEnsureReflectionSessionMutation: () => ({
    error: null,
    isPending: false,
    mutate: ensureSessionMutate,
  }),
  useReflectionSessionForBook: () => ({
    sessionId: 3,
    sessions: { isLoading: false },
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
    ensureSessionMutate.mockClear();
    saveMutate.mockClear();
    startInterviewMutate.mockClear();
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
      '모든 변경 사항이 저장되었습니다.',
    );

    fireEvent.change(editor, { target: { value: '  수정한 생각  ' } });

    expect(save).toBeEnabled();
    expect(interview).toBeDisabled();
    expect(screen.getByTestId('reflection-save-status')).toHaveTextContent(
      '저장되지 않은 변경 사항',
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
    expect(screen.getByTestId('reflection-run-recovery')).toHaveTextContent('원래 발제안 version');

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
      '시작한 발제안 version',
    );

    fireEvent.click(resume);

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/book/1/reflection/refine/41');
  });

  it('shows the server empty-state message and keeps an empty editor for a missing Reflection', async () => {
    const error = new ApiRequestError(
      'COMMON_NOT_FOUND',
      404,
      [],
      'request-123',
      undefined,
      '아직 작성된 Reflection이 없어. 지금의 생각을 먼저 적어 저장해줘.',
    );
    reflectionQuery = {
      data: undefined,
      isFetching: false,
      error,
      isError: true,
      refetch: vi.fn(),
    };

    renderPanel();

    expect(await screen.findByText('Reflection을 아직 작성하지 않았어')).toBeInTheDocument();
    expect(screen.getByText(error.message)).toBeInTheDocument();
    expect(screen.getByTestId('primary-reflection-content')).toHaveValue('');
    expect(screen.getByTestId('primary-reflection-save')).toBeDisabled();
  });
});
