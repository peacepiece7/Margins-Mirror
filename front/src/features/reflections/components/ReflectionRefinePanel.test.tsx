import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
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

vi.mock('../reflection-loop-queries', () => ({
  useDiscussionRunQuery: () => ({
    data: { guideId: 7, runId: 9, status: 'COMPLETED' },
    error: null,
  }),
  useReflectionRefinementQuery: () => ({
    data: {
      currentContent: '현재 생각',
      initialContent: '처음 생각',
      perspectiveSummary: '다른 관점',
      reflectionId: 11,
      runId: 9,
      suggestedContent,
      suggestionStatus,
    },
    error: null,
    isError: false,
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
  });

  function render(ui: ReactNode) {
    return rtlRender(<I18nProvider>{ui}</I18nProvider>);
  }

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
    expect(screen.getByTestId('reflection-save-refinement')).toHaveTextContent('새 revision 저장');
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
    expect(screen.getByTestId('reflection-save-refinement')).toBeEnabled();
  });
});
