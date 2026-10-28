import {
  act,
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { ReflectionRefinePanel } from './ReflectionRefinePanel';

const saveMutate = vi.fn();
let savePending = false;
let saveVariables: { mode: 'EDITED' | 'ACCEPTED_SUGGESTION' | 'KEPT' } | undefined;
let suggestionStatus: 'PENDING' | 'READY' | 'FAILED' = 'READY';
let suggestedContent: string | null = 'AI 제안';
let currentContent = '현재 생각';
let readError: Error | null = null;
let emptyRun = false;
const runRefetch = vi.fn();

vi.mock('../reflection-loop-queries', () => ({
  useDiscussionRunQuery: (runId: number) => ({
    data: emptyRun ? undefined : { guideId: 7, runId, status: 'COMPLETED' },
    error: null,
    isSuccess: true,
    refetch: runRefetch,
  }),
  useReflectionRefinementQuery: (runId: number) => ({
    data: {
      currentContent,
      initialContent: '처음 생각',
      perspectiveSummary: '다른 관점',
      reflectionId: 11,
      runId,
      suggestedContent,
      suggestionStatus,
    },
    error: readError,
    isError: Boolean(readError),
    isFetching: false,
    refetch: vi.fn(),
  }),
  useSaveReflectionRefinementMutation: () => ({
    error: null,
    isError: false,
    isPending: savePending,
    mutate: saveMutate,
    reset: vi.fn(),
    variables: saveVariables,
  }),
}));

describe('ReflectionRefinePanel', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'ko');
    saveMutate.mockClear();
    savePending = false;
    saveVariables = undefined;
    suggestionStatus = 'READY';
    suggestedContent = 'AI 제안';
    currentContent = '현재 생각';
    readError = null;
    emptyRun = false;
    runRefetch.mockClear();
  });

  function render(ui: ReactNode) {
    return rtlRender(<I18nProvider>{ui}</I18nProvider>);
  }

  it('preserves dirty content on polling but updates an untouched editor', async () => {
    const ui = () => (
      <MemoryRouter>
        <ReflectionRefinePanel bookId={1} runId={9} />
      </MemoryRouter>
    );
    const view = render(ui());
    currentContent = '최신 persisted 본문';
    view.rerender(<I18nProvider>{ui()}</I18nProvider>);
    await waitFor(() =>
      expect(screen.getByLabelText('최종 Reflection 본문')).toHaveValue(currentContent),
    );
    fireEvent.change(screen.getByLabelText('최종 Reflection 본문'), {
      target: { value: '초안 유지' },
    });
    currentContent = 'polling 본문';
    view.rerender(<I18nProvider>{ui()}</I18nProvider>);
    expect(screen.getByLabelText('최종 Reflection 본문')).toHaveValue('초안 유지');
  });

  it('serializes save and keep, and permits retry without losing the draft', async () => {
    render(
      <MemoryRouter>
        <ReflectionRefinePanel bookId={1} runId={9} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('최종 Reflection 본문'), {
      target: { value: '저장 초안' },
    });
    await waitFor(() => expect(screen.getByTestId('reflection-save-refinement')).toBeEnabled());
    fireEvent.click(screen.getByTestId('reflection-save-refinement'));
    fireEvent.click(screen.getByTestId('reflection-keep-original'));
    expect(saveMutate).toHaveBeenCalledOnce();
    expect(saveMutate.mock.calls[0][0]).toEqual({
      mode: 'EDITED',
      outcome: 'DEEPENED',
      finalContent: '저장 초안',
    });
    act(() => saveMutate.mock.calls[0][1].onSettled());
    expect(screen.getByLabelText('최종 Reflection 본문')).toHaveValue('저장 초안');
    fireEvent.click(screen.getByTestId('reflection-keep-original'));
    expect(saveMutate.mock.calls[1][0]).toEqual({ mode: 'KEPT', outcome: 'KEPT' });
  });

  it('resets draft, suggestion undo and outcome for another run', async () => {
    const ui = (runId: number) => (
      <MemoryRouter>
        <ReflectionRefinePanel bookId={1} runId={runId} />
      </MemoryRouter>
    );
    const view = render(ui(9));
    await waitFor(() =>
      expect(screen.getByLabelText('최종 Reflection 본문')).toHaveValue('현재 생각'),
    );
    fireEvent.change(screen.getByLabelText('최종 Reflection 본문'), {
      target: { value: '이전 run 초안' },
    });
    fireEvent.click(screen.getByRole('button', { name: '제안을 편집기에 넣기' }));
    fireEvent.change(screen.getByLabelText('대화 뒤 변화'), { target: { value: 'CHANGED' } });
    currentContent = '다음 run 본문';
    view.rerender(<I18nProvider>{ui(10)}</I18nProvider>);
    await waitFor(() =>
      expect(screen.getByLabelText('최종 Reflection 본문')).toHaveValue('다음 run 본문'),
    );
    expect(
      screen.queryByRole('button', { name: '이전 편집 내용 되돌리기' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('대화 뒤 변화')).toHaveValue('DEEPENED');
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it('blocks keep and save after a required read fails and offers retry', () => {
    readError = new Error('private provider detail');
    render(
      <MemoryRouter>
        <ReflectionRefinePanel bookId={1} runId={9} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('reflection-keep-original')).toBeDisabled();
    expect(screen.getByTestId('reflection-save-refinement')).toBeDisabled();
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeEnabled();
    expect(screen.queryByText('private provider detail')).not.toBeInTheDocument();
  });

  it('offers retry and blocks writes for an empty successful run payload', () => {
    emptyRun = true;
    render(
      <MemoryRouter>
        <ReflectionRefinePanel bookId={1} runId={9} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('reflection-keep-original')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(runRefetch).toHaveBeenCalledOnce();
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it('keeps AI suggestion application reversible and avoids an unchanged revision', async () => {
    render(
      <MemoryRouter>
        <ReflectionRefinePanel bookId={1} runId={9} />
      </MemoryRouter>,
    );

    const editor = screen.getByLabelText('최종 Reflection 본문');
    const save = screen.getByTestId('reflection-save-refinement');

    await waitFor(() => expect(editor).toHaveValue('현재 생각'));
    expect(save).toBeDisabled();

    fireEvent.change(editor, { target: { value: '내가 수정한 생각' } });
    fireEvent.click(screen.getByRole('button', { name: '제안을 편집기에 넣기' }));

    expect(editor).toHaveValue('AI 제안');
    expect(screen.getByTestId('refinement-draft-status')).toHaveTextContent(
      'AI 제안을 편집기에 넣었습니다.',
    );

    fireEvent.click(screen.getByRole('button', { name: '이전 편집 내용 되돌리기' }));
    expect(editor).toHaveValue('내가 수정한 생각');

    fireEvent.click(save);
    expect(saveMutate).toHaveBeenCalledWith(
      {
        finalContent: '내가 수정한 생각',
        mode: 'EDITED',
        outcome: 'DEEPENED',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('locks the final editor to the exact values sent while a keep request is pending', async () => {
    savePending = true;
    saveVariables = { mode: 'KEPT' };

    render(
      <MemoryRouter>
        <ReflectionRefinePanel bookId={1} runId={9} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByLabelText('최종 Reflection 본문')).toBeDisabled());
    expect(screen.getByLabelText('대화 뒤 변화')).toBeDisabled();
    expect(screen.getByTestId('reflection-keep-original')).toHaveTextContent('선택 저장 중…');
    expect(screen.getByTestId('reflection-save-refinement')).toHaveTextContent('새 수정본 저장');
  });

  it('keeps direct edit and keep actions available when the AI suggestion failed', async () => {
    suggestionStatus = 'FAILED';
    suggestedContent = null;

    render(
      <MemoryRouter>
        <ReflectionRefinePanel bookId={1} runId={9} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('최종 Reflection 본문')).toHaveValue('현재 생각'),
    );
    expect(screen.getByText('AI 제안을 만들지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '제안을 편집기에 넣기' })).toBeDisabled();
    expect(screen.getByTestId('reflection-keep-original')).toBeEnabled();

    fireEvent.change(screen.getByLabelText('최종 Reflection 본문'), {
      target: { value: '직접 다듬은 생각' },
    });
    await waitFor(() =>
      expect(screen.getByLabelText('최종 Reflection 본문')).toHaveValue('직접 다듬은 생각'),
    );
    await waitFor(() =>
      expect(screen.getByTestId('refinement-draft-status')).toHaveTextContent('저장'),
    );
    await waitFor(() => expect(screen.getByTestId('reflection-save-refinement')).toBeEnabled());
  });
});
