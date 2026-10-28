import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';
import { ReviewEditorPanel } from './ReviewEditorPanel';
import { reflectionsApi } from '../api';

const saveMutate = vi.fn();
const flags = vi.hoisted(() => ({ developerDebugEnabled: true }));
vi.mock('@/lib/feature-flags', () => flags);
vi.mock('../api', () => ({ reflectionsApi: { developerDraft: vi.fn() } }));

vi.mock('../queries', () => ({
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
    vi.clearAllMocks();
    flags.developerDebugEnabled = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 29, 23, 30));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function renderEditor() {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/book/1/review/new']}>
          <I18nProvider>
            <ReviewEditorPanel bookId={1} />
          </I18nProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('defaults a new review date to the browser-local current date', () => {
    renderEditor();

    expect(screen.getByLabelText('Review date')).toHaveValue('2026-07-29');
  });

  it('generates an unsaved primary reflection without changing metadata', async () => {
    vi.useRealTimers();
    vi.mocked(reflectionsApi.developerDraft).mockResolvedValue({
      content: 'Generated reflection',
      model: 'gpt-6-luna',
      personas: [],
    });
    renderEditor();
    fireEvent.change(screen.getByTestId('reflection-content-textarea'), {
      target: { value: 'My draft' },
    });
    fireEvent.change(screen.getByTestId('reflection-author-input'), {
      target: { value: 'Reader' },
    });
    fireEvent.click(screen.getByTestId('developer-draft-generate'));
    await waitFor(() =>
      expect(screen.getByTestId('reflection-content-textarea')).toHaveValue('Generated reflection'),
    );
    expect(reflectionsApi.developerDraft).toHaveBeenCalledWith({
      bookId: 1,
      context: 'My draft',
      subject: undefined,
      target: 'PRIMARY_REFLECTION',
    });
    expect(screen.getByTestId('reflection-author-input')).toHaveValue('Reader');
    expect(screen.getByTestId('reflection-visibility-select')).toHaveValue('PRIVATE');
    expect(saveMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId('review-editor-page')).toBeVisible();
  });

  it('preserves the current reflection on generation failure', async () => {
    vi.useRealTimers();
    vi.mocked(reflectionsApi.developerDraft).mockRejectedValue(new Error('upstream'));
    renderEditor();
    fireEvent.change(screen.getByTestId('reflection-content-textarea'), {
      target: { value: 'Keep this' },
    });
    fireEvent.click(screen.getByTestId('developer-draft-generate'));
    await screen.findByRole('alert');
    expect(screen.getByTestId('reflection-content-textarea')).toHaveValue('Keep this');
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it('hides the draft control when developer debug is off', () => {
    flags.developerDebugEnabled = false;
    renderEditor();
    expect(screen.queryByTestId('developer-draft-generate')).not.toBeInTheDocument();
    expect(reflectionsApi.developerDraft).not.toHaveBeenCalled();
  });
});
