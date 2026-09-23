import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';
import type { DiscussionGuideProjectionResponse } from '@/types/api/reflection-loop';

import { DiscussionGuidePreview } from './DiscussionGuidePreview';

describe('DiscussionGuidePreview', () => {
  beforeEach(() => window.localStorage.setItem('margins.locale', 'ko'));
  afterEach(() => {
    cleanup();
    window.localStorage.removeItem('margins.locale');
  });

  it('keeps projection controls visible but hides persisted preview during editing', () => {
    renderPreview({
      draftActive: true,
      projection: participantProjection(),
    });

    expect(screen.getByTestId('discussion-guide-facilitator-tab')).toBeDisabled();
    expect(screen.getByTestId('discussion-guide-participant-tab')).toBeDisabled();
    expect(screen.getByTestId('discussion-guide-download-markdown')).toBeDisabled();
    expect(screen.queryByTestId('discussion-guide-participant-preview')).not.toBeInTheDocument();
  });

  it('announces loading and failure without enabling an empty export', () => {
    const { rerender } = renderPreview({ projection: undefined });

    expect(screen.getByRole('status')).toHaveTextContent('미리보기를 준비');
    expect(screen.getByTestId('discussion-guide-download-markdown')).toBeDisabled();
    const facilitatorTab = screen.getByTestId('discussion-guide-facilitator-tab');
    const participantTab = screen.getByTestId('discussion-guide-participant-tab');
    const facilitatorPanel = document.getElementById(
      facilitatorTab.getAttribute('aria-controls') ?? '',
    );
    const participantPanel = document.getElementById(
      participantTab.getAttribute('aria-controls') ?? '',
    );
    expect(facilitatorPanel).toHaveAttribute('role', 'tabpanel');
    expect(facilitatorPanel).toHaveAttribute('tabindex', '0');
    expect(participantPanel).toHaveClass('data-[state=inactive]:hidden');
    expect(participantPanel).toHaveAttribute('tabindex', '-1');

    rerender(
      <I18nProvider>
        <DiscussionGuidePreview
          draftActive={false}
          exportPending={false}
          onExport={vi.fn()}
          onProjectionTypeChange={vi.fn()}
          projection={undefined}
          projectionError
          projectionType="FACILITATOR"
        />
      </I18nProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('미리보기를 불러오지 못했습니다');
  });
});

function renderPreview(options: {
  draftActive?: boolean;
  projection?: DiscussionGuideProjectionResponse;
}) {
  const draftActive = options.draftActive ?? false;
  const projection = 'projection' in options ? options.projection : participantProjection();

  return render(
    <I18nProvider>
      <DiscussionGuidePreview
        draftActive={draftActive}
        exportPending={false}
        onExport={vi.fn()}
        onProjectionTypeChange={vi.fn()}
        projection={projection}
        projectionError={false}
        projectionType={projection?.projection ?? 'FACILITATOR'}
      />
    </I18nProvider>,
  );
}

function participantProjection(): DiscussionGuideProjectionResponse {
  return {
    bookAuthor: '저자',
    bookTitle: '함께 읽는 책',
    current: true,
    goal: '참여자 목표',
    guideId: 7,
    guideVersion: 2,
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
