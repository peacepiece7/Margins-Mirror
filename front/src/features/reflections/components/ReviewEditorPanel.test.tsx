import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';
import { ReviewEditorPanel } from './ReviewEditorPanel';

const saveMutate = vi.fn();

vi.mock('../queries', () => ({
  useEnsureReflectionSessionMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useReflectionTimelineForBook: () => ({
    sessionId: 1,
    sessions: { isLoading: false },
    timeline: {
      data: { insights: [] },
      isFetching: false,
    },
  }),
  useSaveReflectionMutation: () => ({
    isPending: false,
    mutate: saveMutate,
  }),
}));

describe('ReviewEditorPanel', () => {
  beforeEach(() => {
    saveMutate.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 29, 23, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults a new review date to the browser-local current date', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <ReviewEditorPanel bookId={1} />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Review date')).toHaveValue('2026-07-29');
  });
});
