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
    expect(screen.getByText('book-knowledge-v1')).toBeVisible();
    expect(screen.getByText('업데이트 필요')).toBeVisible();
    expect(screen.getByText('임시 분석')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '지금 갱신하기' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
