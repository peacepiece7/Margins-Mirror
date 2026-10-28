import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';
import type { DeveloperReflectionDraftInput } from '@/types/api/reflection-loop';

import { reflectionsApi } from '../api';
import { DeveloperDraftControl } from './DeveloperDraftControl';

vi.mock('@/lib/feature-flags', () => ({
  developerDebugEnabled: true,
  reflectionLoopEnabled: true,
}));

vi.mock('../api', () => ({
  reflectionsApi: { developerDraft: vi.fn() },
}));

describe('DeveloperDraftControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('margins.locale', 'ko');
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  function renderControl(
    onGenerated = vi.fn(),
    input: Partial<Pick<DeveloperReflectionDraftInput, 'context' | 'subject' | 'target'>> = {},
  ) {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const ui = (draftKey: number) => (
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <DeveloperDraftControl
            bookId={7}
            draftKey={draftKey}
            context="저장 전 입력"
            onGenerated={onGenerated}
            subject="질문"
            target="INTERVIEW_ANSWER"
            {...input}
          />
        </I18nProvider>
      </QueryClientProvider>
    );
    const view = render(ui(21));
    return {
      ...view,
      queryClient,
      onGenerated,
      rerenderControl: (draftKey: number) => view.rerender(ui(draftKey)),
    };
  }

  it('fills only through its callback and shows actual model and Persona badges', async () => {
    vi.mocked(reflectionsApi.developerDraft).mockResolvedValue({
      content: '생성된 초안',
      model: 'gpt-6-luna',
      personas: [
        { personaId: 11, displayName: '기자' },
        { personaId: 12, displayName: '개발자' },
      ],
    });
    const { onGenerated } = renderControl();

    fireEvent.click(screen.getByRole('button', { name: '개발자 초안 생성' }));

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith('생성된 초안'));
    expect(reflectionsApi.developerDraft).toHaveBeenCalledWith({
      bookId: 7,
      context: '저장 전 입력',
      subject: '질문',
      target: 'INTERVIEW_ANSWER',
    });
    expect(screen.getByText('gpt-6-luna')).toBeVisible();
    expect(screen.getByText('기자')).toBeVisible();
    expect(screen.getByText('개발자')).toBeVisible();
    expect(screen.getByRole('button', { name: '새 초안 다시 생성' })).toBeEnabled();
  });

  it.each([
    'PRIMARY_REFLECTION',
    'QUESTION_ANSWER',
    'INTERVIEW_ANSWER',
    'DISCUSSION_TURN',
  ] as const)(
    'bounds long context and subject for %s without changing the caller input',
    async (target) => {
      vi.mocked(reflectionsApi.developerDraft).mockRejectedValue(new Error('upstream'));
      const input = {
        context: '가'.repeat(8000) + 'context overflow',
        subject: '나'.repeat(2000) + 'subject overflow',
        target,
      };
      const { onGenerated } = renderControl(vi.fn(), input);

      fireEvent.click(screen.getByRole('button', { name: '개발자 초안 생성' }));

      await screen.findByRole('alert');
      expect(reflectionsApi.developerDraft).toHaveBeenCalledWith({
        bookId: 7,
        context: '가'.repeat(8000),
        subject: '나'.repeat(2000),
        target,
      });
      expect(input.context).toBe('가'.repeat(8000) + 'context overflow');
      expect(input.subject).toBe('나'.repeat(2000) + 'subject overflow');
      expect(onGenerated).not.toHaveBeenCalled();
    },
  );

  it.each([
    'PRIMARY_REFLECTION',
    'QUESTION_ANSWER',
    'INTERVIEW_ANSWER',
    'DISCUSSION_TURN',
  ] as const)(
    'preserves the full %s editor and requires explicit save after retry',
    async (target) => {
      const original = '가'.repeat(8000) + ' 원문 끝';
      const subject = '나'.repeat(2000) + ' 질문 끝';
      const onSaved = vi.fn();
      let rejectDraft!: (error: Error) => void;
      vi.mocked(reflectionsApi.developerDraft)
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectDraft = reject;
            }),
        )
        .mockResolvedValueOnce({ content: '재시도 초안', model: 'gpt-6-luna', personas: [] });
      const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

      function Editor() {
        const [content, setContent] = useState(original);
        return (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSaved(content);
            }}
          >
            <textarea
              aria-label="현재 원문"
              onChange={(event) => setContent(event.target.value)}
              value={content}
            />
            <DeveloperDraftControl
              bookId={7}
              context={content}
              draftKey={21}
              onGenerated={setContent}
              subject={subject}
              target={target}
            />
            <button type="submit">명시적 저장</button>
          </form>
        );
      }
      render(
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <Editor />
          </I18nProvider>
        </QueryClientProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: '개발자 초안 생성' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '초안 생성 중…' })).toBeDisabled(),
      );
      expect(screen.getByRole('textbox', { name: '현재 원문' })).toHaveValue(original);
      expect(onSaved).not.toHaveBeenCalled();
      expect(reflectionsApi.developerDraft).toHaveBeenCalledWith({
        bookId: 7,
        context: '가'.repeat(8000),
        subject: '나'.repeat(2000),
        target,
      });

      rejectDraft(new Error('upstream'));
      await screen.findByRole('alert');
      expect(screen.getByRole('textbox', { name: '현재 원문' })).toHaveValue(original);
      expect(onSaved).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '개발자 초안 생성' }));
      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: '현재 원문' })).toHaveValue('재시도 초안'),
      );
      expect(onSaved).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '명시적 저장' }));
      expect(onSaved).toHaveBeenCalledExactlyOnceWith('재시도 초안');
    },
  );

  it.each([
    { context: '가'.repeat(8000), subject: '나'.repeat(2000) },
    { context: '', subject: '' },
    { context: undefined, subject: undefined },
  ])('preserves context and subject within the request limits (%#)', async (input) => {
    vi.mocked(reflectionsApi.developerDraft).mockResolvedValue({
      content: '초안',
      model: 'gpt-6-luna',
      personas: [],
    });
    const { onGenerated } = renderControl(vi.fn(), input);

    fireEvent.click(screen.getByRole('button', { name: '개발자 초안 생성' }));

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith('초안'));
    expect(reflectionsApi.developerDraft).toHaveBeenCalledWith({
      bookId: 7,
      target: 'INTERVIEW_ANSWER',
      ...input,
    });
  });

  it('blocks duplicate clicks while pending', async () => {
    let resolveDraft:
      ((value: Awaited<ReturnType<typeof reflectionsApi.developerDraft>>) => void) | undefined;
    vi.mocked(reflectionsApi.developerDraft).mockReturnValue(
      new Promise((resolve) => {
        resolveDraft = resolve;
      }),
    );
    renderControl();

    const button = screen.getByRole('button', { name: '개발자 초안 생성' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);
    expect(reflectionsApi.developerDraft).toHaveBeenCalledTimes(1);

    resolveDraft?.({ content: '완료', model: 'gpt-6-luna', personas: [] });
    await screen.findByRole('button', { name: '새 초안 다시 생성' });
  });

  it('preserves the caller value on failure and localizes the retryable alert', async () => {
    vi.mocked(reflectionsApi.developerDraft).mockRejectedValue(new Error('upstream'));
    const { onGenerated } = renderControl();

    fireEvent.click(screen.getByRole('button', { name: '개발자 초안 생성' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('개발자 초안을 만들지 못했어요');
    expect(screen.getByRole('alert')).toHaveTextContent('현재 입력은 그대로예요');
    expect(onGenerated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '개발자 초안 생성' })).toBeEnabled();
  });

  it('uses English copy from the live locale catalog', () => {
    window.localStorage.setItem('margins.locale', 'en');
    renderControl();
    expect(screen.getByRole('button', { name: 'Generate developer draft' })).toBeVisible();
    expect(screen.getByText(/Development only/)).toBeVisible();
  });

  it.each(['question changed', 'editor closed'])(
    'discards a late response when %s',
    async (transition) => {
      let resolveDraft!: (value: Awaited<ReturnType<typeof reflectionsApi.developerDraft>>) => void;
      vi.mocked(reflectionsApi.developerDraft).mockReturnValue(
        new Promise((resolve) => {
          resolveDraft = resolve;
        }),
      );
      const view = renderControl();
      fireEvent.click(screen.getByRole('button', { name: '개발자 초안 생성' }));
      await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());

      if (transition === 'question changed') view.rerenderControl(22);
      else view.unmount();
      resolveDraft({ content: '이전 질문의 초안', model: 'gpt-6-luna', personas: [] });
      await waitFor(() =>
        expect(view.queryClient.getMutationCache().getAll()[0].state.status).toBe('success'),
      );
      expect(view.onGenerated).not.toHaveBeenCalled();
      if (transition === 'question changed') {
        expect(screen.getByRole('button', { name: '개발자 초안 생성' })).toBeEnabled();
        expect(screen.queryByText('gpt-6-luna')).not.toBeInTheDocument();
      }
    },
  );

  it.each(['success', 'failure'])(
    'clears previous %s metadata on the next question',
    async (outcome) => {
      if (outcome === 'success') {
        vi.mocked(reflectionsApi.developerDraft).mockResolvedValue({
          content: '초안',
          model: 'gpt-6-luna',
          personas: [{ personaId: 11, displayName: '기자' }],
        });
      } else vi.mocked(reflectionsApi.developerDraft).mockRejectedValue(new Error('upstream'));
      const view = renderControl();
      fireEvent.click(screen.getByRole('button', { name: '개발자 초안 생성' }));
      if (outcome === 'success') await screen.findByText('기자');
      else await screen.findByRole('alert');

      view.rerenderControl(22);

      expect(screen.getByRole('button', { name: '개발자 초안 생성' })).toBeEnabled();
      expect(screen.queryByText('gpt-6-luna')).not.toBeInTheDocument();
      expect(screen.queryByText('기자')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );
});
