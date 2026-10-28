import {
  act,
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReflectionLoopResponse } from '@/types/api/reflection-loop';
import { I18nProvider } from '@/lib/i18n';
import { ApiRequestError } from '@/lib/api-client';

import { ReflectionLoopPanel } from './ReflectionLoopPanel';

const saveMutate = vi.fn();
const startInterviewMutate = vi.fn();
let savePending = false;
let saveError: Error | null = null;
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
    error: saveError,
    isError: Boolean(saveError),
    isPending: savePending,
    mutate: saveMutate,
    reset: vi.fn(),
  }),
  useStartReflectionInterviewMutation: () => ({
    error: null,
    isPending: false,
    mutate: startInterviewMutate,
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

function LocationProbe() {
  return <output data-testid="location-probe">{useLocation().pathname}</output>;
}

function renderPanel() {
  return rtlRender(
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
  it('resets an unsaved body and visibility when the book changes', async () => {
    const view = renderPanel();
    await waitFor(() =>
      expect(screen.getByLabelText('Reflection 본문')).toHaveValue('저장된 생각'),
    );
    fireEvent.change(screen.getByLabelText('Reflection 본문'), {
      target: { value: '이전 책 초안' },
    });
    fireEvent.change(screen.getByLabelText('Reflection 공개 범위'), {
      target: { value: 'PUBLIC' },
    });
    reflectionSessionId = 4;
    reflectionData = {
      ...reflectionData,
      sessionId: 4,
      visibility: 'PRIVATE',
      currentRevision: { ...reflectionData.currentRevision, content: '새 책 본문' },
    };
    view.rerender(
      <I18nProvider>
        <MemoryRouter>
          <ReflectionLoopPanel bookId={2} />
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText('Reflection 본문')).toHaveValue('새 책 본문'));
    expect(screen.getByLabelText('Reflection 공개 범위')).toHaveValue('PRIVATE');
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it('blocks writing when the primary Reflection read fails', async () => {
    reflectionQuery = {
      ...reflectionQuery,
      data: undefined,
      error: new ApiRequestError('COMMON_INTERNAL_ERROR', 500),
      isError: true,
    };
    renderPanel();
    fireEvent.change(screen.getByLabelText('Reflection 본문'), {
      target: { value: 'retry draft' },
    });
    expect(screen.getByTestId('primary-reflection-save')).toBeDisabled();
    expect(screen.getByTestId('primary-reflection-save').closest('form')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    fireEvent.click(screen.getByTestId('primary-reflection-save'));
    expect(saveMutate).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'ko');
    saveMutate.mockClear();
    startInterviewMutate.mockClear();
    savePending = false;
    saveError = null;
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

  it('preserves dirty body but updates pristine visibility and body on refetch', async () => {
    const view = renderPanel();
    const ui = () => (
      <I18nProvider>
        <MemoryRouter>
          <ReflectionLoopPanel bookId={1} />
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>
    );
    fireEvent.change(screen.getByLabelText('Reflection 본문'), { target: { value: '작성 중' } });
    reflectionData = {
      ...reflectionData,
      visibility: 'PUBLIC',
      currentRevision: { ...reflectionData.currentRevision, content: 'refetch 본문' },
    };
    view.rerender(ui());
    await waitFor(() =>
      expect(screen.getByLabelText('Reflection 공개 범위')).toHaveValue('PUBLIC'),
    );
    expect(screen.getByLabelText('Reflection 본문')).toHaveValue('작성 중');
    fireEvent.change(screen.getByLabelText('Reflection 본문'), {
      target: { value: 'refetch 본문' },
    });
    reflectionData = {
      ...reflectionData,
      currentRevision: { ...reflectionData.currentRevision, content: '다음 persisted 본문' },
    };
    view.rerender(ui());
    await waitFor(() =>
      expect(screen.getByLabelText('Reflection 본문')).toHaveValue('다음 persisted 본문'),
    );
  });

  it('serializes repeated submits, retains a failed draft and resets only after success', async () => {
    const view = renderPanel();
    fireEvent.change(screen.getByLabelText('Reflection 본문'), { target: { value: '새 본문' } });
    const form = screen.getByTestId('primary-reflection-save').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(saveMutate).toHaveBeenCalledOnce());
    act(() => saveMutate.mock.calls[0][1].onSettled());
    saveError = new Error('private failure detail');
    view.rerender(
      <I18nProvider>
        <MemoryRouter>
          <ReflectionLoopPanel bookId={1} />
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.getByLabelText('Reflection 본문')).toHaveValue('새 본문');
    expect(screen.queryByText('private failure detail')).not.toBeInTheDocument();
    fireEvent.submit(form);
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(2));
    const result = {
      ...reflectionData,
      currentRevision: { ...reflectionData.currentRevision, content: '새 본문' },
    };
    act(() => {
      saveMutate.mock.calls[1][1].onSuccess(result);
      saveMutate.mock.calls[1][1].onSettled();
    });
    expect(screen.getByTestId('primary-reflection-save')).toBeDisabled();
  });

  it('locks body and visibility while saving', () => {
    savePending = true;
    renderPanel();
    expect(screen.getByLabelText('Reflection 본문')).toBeDisabled();
    expect(screen.getByLabelText('Reflection 공개 범위')).toBeDisabled();
    expect(screen.getByTestId('primary-reflection-save').closest('form')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByTestId('reflection-start-interview')).toBeDisabled();
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
    await waitFor(() =>
      expect(saveMutate).toHaveBeenCalledWith(
        {
          content: '수정한 생각',
          title: 'Reflection',
          visibility: 'PRIVATE',
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onSettled: expect.any(Function),
        }),
      ),
    );
  });

  it('puts a generated Primary Reflection only in the unsaved editor', async () => {
    renderPanel();
    const editor = await screen.findByLabelText('Reflection 본문');

    fireEvent.click(screen.getByRole('button', { name: 'debug-PRIMARY_REFLECTION' }));

    expect(editor).toHaveValue('draft-PRIMARY_REFLECTION');
    expect(screen.getByTestId('reflection-save-status')).toHaveTextContent(
      '저장하지 않은 변경 사항',
    );
    expect(saveMutate).not.toHaveBeenCalled();
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

    await waitFor(() => expect(saveMutate).toHaveBeenCalledOnce());
    expect(saveMutate).toHaveBeenCalledWith(
      {
        content: '처음 남기는 생각',
        title: 'Reflection',
        visibility: 'PRIVATE',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
