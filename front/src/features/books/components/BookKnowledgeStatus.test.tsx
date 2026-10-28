import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { BookKnowledgeStatus } from './BookKnowledgeStatus';

describe('BookKnowledgeStatus', () => {
  beforeEach(() => window.localStorage.setItem('margins.locale', 'ko'));
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it.each([
    { backgroundPending: true, backgroundError: false },
    { backgroundPending: false, backgroundError: true },
  ])('keeps personal loading/error compact and blocks editing: %j', (state) => {
    render(
      <I18nProvider>
        <BookKnowledgeStatus
          {...state}
          pending={false}
          error={false}
          refreshing={false}
          onEdit={vi.fn()}
          onRefresh={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByTestId('book-knowledge-status')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('책 배경 정보'));
    expect(screen.getByRole('button', { name: '배경 정보 편집' })).toBeDisabled();
  });

  it('displays private summary even when the shared AI original is unavailable', () => {
    render(
      <I18nProvider>
        <BookKnowledgeStatus
          background={{ summary: '내 배경 정보', revision: 2, updatedAt: null }}
          pending={false}
          error={true}
          refreshing={false}
          onEdit={vi.fn()}
          onRefresh={vi.fn()}
        />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByText('책 배경 정보'));
    expect(screen.getByText('내 배경 정보')).toBeVisible();
    expect(screen.getByRole('button', { name: '배경 정보 편집' })).toBeEnabled();
  });

  it.each(['book-knowledge-v1', 'private-prompt-v2'])(
    'does not render internal Knowledge version %s in either disclosure state',
    (version) => {
      render(
        <I18nProvider>
          <BookKnowledgeStatus
            error={false}
            knowledge={{
              author: '저자',
              discussionPoints: [],
              fallbackUsed: false,
              famousQuotes: [],
              generationLocale: 'en',
              keywords: [],
              knowledgeId: 1,
              recommendedPersonas: [],
              refreshPending: false,
              stale: false,
              status: 'ready',
              summary: '책 배경 요약',
              themes: [],
              title: '책',
              version,
            }}
            onRefresh={vi.fn()}
            pending={false}
            refreshing={false}
          />
        </I18nProvider>,
      );

      const disclosure = screen.getByTestId('book-knowledge-status');
      expect(disclosure).not.toHaveTextContent(version);
      expect(disclosure.querySelector('.flex.flex-wrap.gap-1')).toBeNull();

      fireEvent.click(screen.getByText('책 배경 정보'));

      expect(disclosure).not.toHaveTextContent(version);
      expect(disclosure.querySelector('.flex.flex-wrap.gap-1')).toBeNull();
      expect(screen.getByText('책 배경 요약')).toBeVisible();
      expect(screen.getByRole('button', { name: '책 배경 정보 다시 불러오기' })).toBeVisible();
    },
  );

  it.each([
    { stale: true, fallbackUsed: false, refreshPending: false, label: '업데이트 필요' },
    { stale: false, fallbackUsed: true, refreshPending: false, label: '임시 분석' },
    { stale: false, fallbackUsed: false, refreshPending: true, label: '갱신 중' },
  ])('preserves an isolated status badge and refresh behavior: $label', (state) => {
    const onRefresh = vi.fn();
    render(
      <I18nProvider>
        <BookKnowledgeStatus
          error={false}
          knowledge={{
            author: '저자',
            discussionPoints: [],
            fallbackUsed: state.fallbackUsed,
            famousQuotes: [],
            generationLocale: 'en',
            keywords: [],
            knowledgeId: 1,
            recommendedPersonas: [],
            refreshPending: state.refreshPending,
            stale: state.stale,
            status: 'ready',
            summary: '책 배경 요약',
            themes: [],
            title: '책',
            version: 'private-prompt-v2',
          }}
          onRefresh={onRefresh}
          pending={false}
          refreshing={false}
        />
      </I18nProvider>,
    );

    const disclosure = screen.getByTestId('book-knowledge-status');
    expect(disclosure).toHaveAttribute('aria-busy', String(state.refreshPending));
    expect(disclosure).not.toHaveTextContent('private-prompt-v2');
    fireEvent.click(screen.getByText('책 배경 정보'));
    expect(disclosure.querySelector('.flex.flex-wrap.gap-1')).toHaveTextContent(state.label);
    expect(screen.getByText('책 배경 요약')).toBeVisible();
    expect(disclosure).not.toHaveTextContent('private-prompt-v2');

    const refresh = screen.getByRole('button', {
      name: state.refreshPending ? '다시 불러오는 중…' : '책 배경 정보 다시 불러오기',
    });
    if (state.refreshPending) {
      expect(refresh).toBeDisabled();
      fireEvent.click(refresh);
      expect(onRefresh).not.toHaveBeenCalled();
    } else {
      expect(refresh).toBeEnabled();
      fireEvent.click(refresh);
      expect(onRefresh).toHaveBeenCalledOnce();
    }
  });

  it('makes stale fallback state and refresh action explicit', () => {
    const onRefresh = vi.fn();
    render(
      <I18nProvider>
        <BookKnowledgeStatus
          error={false}
          knowledge={{
            author: '저자',
            discussionPoints: [],
            fallbackUsed: true,
            famousQuotes: [],
            generationLocale: 'en',
            keywords: [],
            knowledgeId: 1,
            recommendedPersonas: [],
            refreshPending: false,
            stale: true,
            status: 'ready',
            summary: '책 배경 요약',
            themes: [],
            title: '책',
            version: 'book-knowledge-v1',
          }}
          onRefresh={onRefresh}
          pending={false}
          refreshing={false}
        />
      </I18nProvider>,
    );

    expect(screen.getByTestId('book-knowledge-status')).toHaveClass(
      'rounded',
      'border-stone-200',
      'ring-0',
    );
    expect(screen.getByTestId('book-knowledge-status')).not.toHaveClass('rounded-xl');
    expect(screen.getByTestId('book-knowledge-status')).not.toHaveClass('ring-1');
    expect(screen.getByTestId('book-knowledge-status')).not.toHaveAttribute('open');
    expect(screen.getByTestId('book-knowledge-status')).not.toHaveTextContent('book-knowledge-v1');
    expect(screen.getByText('책 배경 요약')).not.toBeVisible();
    fireEvent.click(screen.getByText('책 배경 정보'));
    expect(screen.getByTestId('book-knowledge-status')).not.toHaveTextContent('book-knowledge-v1');
    expect(screen.getAllByText('업데이트 필요').length).toBeGreaterThan(0);
    expect(screen.getByText('임시 분석')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '책 배경 정보 다시 불러오기' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
