import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { DiscussionGuideVersionNavigator } from './DiscussionGuideVersionNavigator';

describe('DiscussionGuideVersionNavigator', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.removeItem('margins.locale');
  });

  it('labels immutable history and selects the requested guide id', () => {
    window.localStorage.setItem('margins.locale', 'ko');
    const onSelect = vi.fn();
    render(
      <I18nProvider>
        <DiscussionGuideVersionNavigator
          disabled={false}
          guideId={8}
          onSelect={onSelect}
          versions={[
            {
              current: false,
              guideId: 7,
              guideVersion: 1,
              hasRun: true,
              origin: 'GENERATED',
              status: 'ARCHIVED',
            },
            {
              current: true,
              guideId: 8,
              guideVersion: 2,
              hasRun: false,
              origin: 'USER_EDIT',
              status: 'READY',
            },
          ]}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('option', { name: 'v1 · 첫 생성 · 토론 연결됨' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'v2 · 직접 편집 · 현재' })).toBeVisible();

    fireEvent.change(screen.getByLabelText('버전 이력'), { target: { value: '7' } });
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it('renders no empty navigation surface', () => {
    window.localStorage.setItem('margins.locale', 'ko');
    const { container } = render(
      <I18nProvider>
        <DiscussionGuideVersionNavigator
          disabled={false}
          guideId={7}
          onSelect={vi.fn()}
          versions={[]}
        />
      </I18nProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
