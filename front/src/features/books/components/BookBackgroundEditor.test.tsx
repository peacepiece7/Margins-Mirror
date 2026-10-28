import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { bookKeys } from '@/lib/query-keys';
import { booksApi } from '../api';
import { BookBackgroundEditor } from './BookBackgroundEditor';

vi.mock('../api', () => ({
  booksApi: { background: vi.fn(), knowledge: vi.fn(), updateBackground: vi.fn() },
}));

describe('BookBackgroundEditor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.setItem('margins.locale', 'en');
    vi.mocked(booksApi.background).mockResolvedValue({
      summary: 'Saved reader background',
      revision: 4,
      updatedAt: null,
    });
    vi.mocked(booksApi.knowledge).mockResolvedValue({ summary: 'AI original' } as Awaited<
      ReturnType<typeof booksApi.knowledge>
    >);
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  function renderEditor() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <I18nProvider>
          <MemoryRouter initialEntries={['/book/7/knowledge/edit']}>
            <Routes>
              <Route path="/book/7/knowledge/edit" element={<BookBackgroundEditor bookId={7} />} />
              <Route path="/book/7" element={<p>Book detail</p>} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );
    return client;
  }

  it('captures revision and draft once, even when a background refetch changes the cache', async () => {
    vi.mocked(booksApi.updateBackground).mockResolvedValue({
      summary: 'My draft',
      revision: 5,
      updatedAt: null,
    });
    const client = renderEditor();
    const input = await screen.findByLabelText('Book background');
    fireEvent.change(input, { target: { value: 'My draft' } });
    client.setQueryData(bookKeys.background(7), {
      summary: 'Other tab',
      revision: 5,
      updatedAt: null,
    });
    expect(input).toHaveValue('My draft');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Book detail');
    expect(booksApi.updateBackground).toHaveBeenCalledWith(7, {
      summary: 'My draft',
      expectedRevision: 4,
    });
  });

  it('keeps the draft and page after a conflict without retrying', async () => {
    vi.mocked(booksApi.updateBackground).mockRejectedValue({ status: 409 });
    renderEditor();
    fireEvent.change(await screen.findByLabelText('Book background'), {
      target: { value: 'Keep my draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Book background')).toHaveValue('Keep my draft');
    expect(booksApi.updateBackground).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Book detail')).not.toBeInTheDocument();
  });

  it('cancels without saving and restores the AI original only through an explicit null write', async () => {
    const client = renderEditor();
    await screen.findByLabelText('Book background');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByText('Book detail');
    expect(booksApi.updateBackground).not.toHaveBeenCalled();
    client.clear();
    cleanup();
    vi.mocked(booksApi.updateBackground).mockResolvedValue({
      summary: null,
      revision: 5,
      updatedAt: null,
    });
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Use AI background' }));
    expect(booksApi.updateBackground).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(booksApi.updateBackground).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use AI background' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Use AI background' }),
    );
    await waitFor(() =>
      expect(booksApi.updateBackground).toHaveBeenCalledWith(7, {
        summary: null,
        expectedRevision: 4,
      }),
    );
  });

  it('can create background when the AI original is unavailable and disables blank save', async () => {
    vi.mocked(booksApi.background).mockResolvedValue({
      summary: null,
      revision: 0,
      updatedAt: null,
    });
    vi.mocked(booksApi.knowledge).mockRejectedValue(new Error('no AI original'));
    renderEditor();
    expect(await screen.findByLabelText('Book background')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Use AI background' })).not.toBeInTheDocument();
  });
});
