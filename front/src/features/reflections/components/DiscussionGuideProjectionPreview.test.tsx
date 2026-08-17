import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { I18nProvider } from '@/lib/i18n';
import type { DiscussionGuideProjectionResponse } from '@/types/api/reflection-loop';

import { DiscussionGuideProjectionPreview } from './DiscussionGuideProjectionPreview';

describe('DiscussionGuideProjectionPreview', () => {
  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'ko');
    document.documentElement.lang = 'ko';
  });

  afterEach(() => {
    cleanup();
    window.localStorage.removeItem('margins.locale');
    document.documentElement.lang = '';
  });

  it('shows facilitator operating context with a private-answer label only', () => {
    renderProjection(facilitatorProjection());

    expect(screen.getByTestId('discussion-guide-facilitator-preview')).toBeVisible();
    expect(screen.getByText('진행 의도')).toBeVisible();
    expect(screen.getByText(/비공개 인터뷰 답변을 AI 생성 문맥으로만 참고/)).toBeVisible();
    expect(screen.getByText('book-knowledge-v1')).toBeVisible();
    expect(screen.getByText('업데이트 필요')).toBeVisible();
    expect(screen.getByText('임시 분석')).toBeVisible();
    expect(screen.queryByText('민감 답변 원문')).not.toBeInTheDocument();
  });

  it('renders a minimal participant handout without facilitator context', () => {
    renderProjection(participantProjection());

    expect(screen.getByTestId('discussion-guide-participant-preview')).toBeVisible();
    expect(screen.getByText('함께 나눌 질문')).toBeVisible();
    expect(screen.queryByText('진행 의도')).not.toBeInTheDocument();
    expect(screen.queryByText(/비공개 인터뷰 답변/)).not.toBeInTheDocument();
    expect(screen.queryByText(/민감도/)).not.toBeInTheDocument();
    expect(screen.queryByText(/분$/)).not.toBeInTheDocument();
  });

  it('renders the shared English catalog when the locale changes', () => {
    window.localStorage.setItem('margins.locale', 'en');
    document.documentElement.lang = 'en';
    renderProjection(facilitatorProjection());

    expect(screen.getByText('Facilitator discussion design')).toBeVisible();
    expect(screen.getAllByText('Required')).not.toHaveLength(0);
    expect(screen.getAllByText('Low sensitivity')).not.toHaveLength(0);
    expect(screen.getByText('Needs update')).toBeVisible();
  });
});

function renderProjection(projection: DiscussionGuideProjectionResponse) {
  render(
    <I18nProvider>
      <DiscussionGuideProjectionPreview projection={projection} />
    </I18nProvider>,
  );
}

function facilitatorProjection(): DiscussionGuideProjectionResponse {
  return {
    bookAuthor: '저자',
    bookTitle: '함께 읽는 책',
    current: true,
    goal: '진행자 목표',
    guideId: 7,
    guideVersion: 2,
    issues: ['첫 논점', '둘째 논점'],
    items: [
      {
        expectedMinutes: 10,
        followUps: ['왜 그렇게 생각하나요?'],
        intent: '진행 의도',
        order: 1,
        priority: 'REQUIRED',
        privateSource: true,
        question: '함께 나눌 질문',
        sensitivity: 'LOW',
        skippable: true,
        sourceExcerpt: null,
        sourceLabel: '비공개 인터뷰 답변',
        sourceType: 'ANSWER',
        stage: 'WARM_UP',
      },
      {
        expectedMinutes: 10,
        followUps: [],
        intent: '책 배경과 연결',
        order: 2,
        priority: 'REQUIRED',
        privateSource: false,
        question: '책 배경과 연결한 질문',
        sensitivity: 'LOW',
        skippable: true,
        sourceExcerpt: '책 배경 요약',
        sourceFallback: true,
        sourceLabel: 'Book Knowledge',
        sourceStale: true,
        sourceType: 'BOOK_KNOWLEDGE',
        sourceVersion: 'book-knowledge-v1',
        stage: 'SOCIAL_VALUE',
      },
    ],
    projection: 'FACILITATOR',
    targetMinutes: 20,
  };
}

function participantProjection(): DiscussionGuideProjectionResponse {
  return {
    bookAuthor: '저자',
    bookTitle: '함께 읽는 책',
    current: false,
    goal: '참여자 목표',
    guideId: 7,
    guideVersion: 1,
    issues: ['첫 논점', '둘째 논점'],
    items: [
      {
        order: 1,
        priority: 'REQUIRED',
        question: '함께 나눌 질문',
        stage: 'WARM_UP',
      },
    ],
    projection: 'PARTICIPANT',
  };
}
