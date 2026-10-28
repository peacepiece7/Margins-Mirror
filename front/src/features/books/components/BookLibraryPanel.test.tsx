import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticatedSessionGuardContext } from '@/lib/authenticated-session-guard';
import { I18nProvider } from '@/lib/i18n';
import { bookKeys } from '@/lib/query-keys';
import { booksApi } from '../api';
import { useBookSelectionStore } from '../selection-store';
import { BookLibraryPanel } from './BookLibraryPanel';

function library() {
  let active = true;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <AuthenticatedSessionGuardContext.Provider value={() => active}>
        <MemoryRouter>
          <I18nProvider>
            <BookLibraryPanel />
          </I18nProvider>
        </MemoryRouter>
      </AuthenticatedSessionGuardContext.Provider>
    </QueryClientProvider>,
  );
  return {
    ...view,
    client,
    rotateSession: () => {
      active = false;
    },
  };
}

async function openDeletion() {
  fireEvent.click(await screen.findByTestId('saved-book-delete'));
  return within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' });
}

beforeEach(() => {
  localStorage.setItem('margins.locale', 'ko');
  useBookSelectionStore.setState({ selectedBookId: 1, shelfFilter: 'all', shelfSort: 'recent' });
  vi.spyOn(booksApi, 'books').mockResolvedValue({
    books: [{ bookId: 1, title: 'Margins', author: 'Author' }],
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Library deletion', () => {
  it('cancels without deleting and confirms through the existing mutation path', async () => {
    const remove = vi.spyOn(booksApi, 'delete').mockResolvedValue(undefined);
    const view = library();
    await openDeletion();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(remove).not.toHaveBeenCalled();
    expect(useBookSelectionStore.getState().selectedBookId).toBe(1);
    fireEvent.click(await openDeletion());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(remove).toHaveBeenCalledWith(1);
    expect(useBookSelectionStore.getState().selectedBookId).toBeUndefined();
    view.client.clear();
  });

  it('waits for deletion, keeps failure open with localized feedback, then retries', async () => {
    let reject!: (error: Error) => void;
    const remove = vi
      .spyOn(booksApi, 'delete')
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const view = library();
    const confirm = await openDeletion();
    fireEvent.click(confirm);
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(confirm).toBeDisabled();
    expect(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '취소' }),
    ).toBeDisabled();
    expect(useBookSelectionStore.getState().selectedBookId).toBe(1);
    fireEvent.click(confirm);
    expect(remove).toHaveBeenCalledOnce();
    await act(async () => reject(new Error('raw deletion failure')));
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent('raw deletion failure');
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      '요청을 처리하지 못했습니다. 다시 시도해 주세요.',
    );
    expect(useBookSelectionStore.getState().selectedBookId).toBe(1);
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(remove).toHaveBeenCalledTimes(2);
    expect(useBookSelectionStore.getState().selectedBookId).toBeUndefined();
    view.client.clear();
  });

  it.each(['selection', 'session'] as const)(
    'does not clear a newer %s on late completion',
    async (change) => {
      let resolve!: () => void;
      vi.spyOn(booksApi, 'delete').mockImplementation(
        () =>
          new Promise<void>((done) => {
            resolve = done;
          }),
      );
      const view = library();
      fireEvent.click(await openDeletion());
      await waitFor(() => expect(booksApi.delete).toHaveBeenCalledOnce());
      if (change === 'session') view.rotateSession();
      act(() => useBookSelectionStore.getState().selectBook(change === 'selection' ? 2 : 1));
      await act(async () => resolve());
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(useBookSelectionStore.getState().selectedBookId).toBe(change === 'selection' ? 2 : 1);
      view.client.clear();
    },
  );
});

describe('Library detail transition', () => {
  it('primes the selected detail cache before opening the existing title route', async () => {
    const view = library();
    const detailLink = await screen.findByTestId('saved-book-detail-link');

    fireEvent.click(detailLink);

    expect(view.client.getQueryData(bookKeys.detail(1))).toEqual({
      bookId: 1,
      title: 'Margins',
      author: 'Author',
    });
    expect(useBookSelectionStore.getState().selectedBookId).toBe(1);
    expect(detailLink).toHaveAttribute('href', '/book/1');
    view.client.clear();
  });
});
