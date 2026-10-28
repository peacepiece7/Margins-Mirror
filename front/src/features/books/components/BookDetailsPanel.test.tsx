import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';
import type { SaveBookResponse } from '@/types/api/book';

import { bookPath } from '../routes';
import { useBookSelectionStore } from '../selection-store';
import { BookDetailsPanel } from './BookDetailsPanel';

const fixture = vi.hoisted(() => ({
  book: undefined as SaveBookResponse | undefined,
  update: vi.fn(),
  shelf: vi.fn(),
  remove: vi.fn(),
  pending: false,
}));
vi.mock('../queries', () => ({
  useBookQuery: () => ({ data: fixture.book }),
  useBookKnowledgeQuery: () => ({ isError: false, isPending: false }),
  useBookBackgroundQuery: () => ({ isError: false, isPending: false }),
  useRegenerateBookKnowledgeMutation: () => ({ isPending: false, isError: false, mutate: vi.fn() }),
  useUpdateBookMutation: () => ({ isPending: fixture.pending, mutate: fixture.update }),
  useUpdateBookShelfMutation: () => ({ isPending: false, mutate: fixture.shelf }),
  useDeleteBookMutation: () => ({ isPending: false, mutateAsync: fixture.remove }),
}));

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function panel(bookId = 1) {
  return (
    <I18nProvider>
      <MemoryRouter initialEntries={[`/book/${bookId}`]}>
        <BookDetailsPanel bookId={bookId} />
        <Location />
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.setItem('margins.locale', 'ko');
  fixture.book = { bookId: 1, title: 'Margins', author: 'Author', rating: 3 };
  fixture.pending = false;
  fixture.update.mockReset();
  fixture.shelf.mockReset();
  fixture.remove.mockReset();
  useBookSelectionStore.getState().selectBook(undefined);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('BookDetailsPanel active book controls', () => {
  it('renders the selected book and starts its review in the active route', () => {
    const { container } = render(panel());
    expect(screen.getByTestId('book-edit-title-input')).toHaveValue('Margins');
    expect(useBookSelectionStore.getState().selectedBookId).toBe(1);

    const trigger = screen.getByTestId('book-detail-status');
    expect(trigger).toHaveAttribute('id', 'book-detail-status');
    expect(trigger).toHaveAccessibleName();
    expect(container.querySelector('select[name="readingStatus"]')).toHaveAttribute(
      'name',
      'readingStatus',
    );
    const ids = Array.from(container.querySelectorAll('[id]'), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);

    fireEvent.click(screen.getByTestId('book-start-review'));
    expect(screen.getByTestId('location')).toHaveTextContent(
      bookPath('review-editor', { bookId: 1 }),
    );
  });

  it('uses loaded server fields while untouched but preserves a draft through shelf refresh', () => {
    fixture.book = undefined;
    const view = render(panel());
    expect(screen.queryByTestId('book-edit-title-input')).not.toBeInTheDocument();
    fixture.book = { bookId: 1, title: 'Loaded title', author: 'Author', rating: 3 };
    view.rerender(panel());
    expect(screen.getByTestId('book-edit-title-input')).toHaveValue('Loaded title');
    fireEvent.change(screen.getByTestId('book-edit-title-input'), {
      target: { value: 'My draft' },
    });
    fireEvent.click(screen.getByTestId('book-detail-rating-full-4'));
    expect(fixture.shelf).toHaveBeenCalledWith({ bookId: 1, shelf: { rating: 4 } });
    fixture.book = { ...fixture.book, title: 'Server title', author: 'Server author', rating: 4 };
    view.rerender(panel());
    expect(screen.getByTestId('book-edit-title-input')).toHaveValue('My draft');
    expect(screen.getByTestId('book-edit-author-input')).toHaveValue('Author');
  });

  it('validates and trims a draft, preserves it on failure and follows the server after successful save', () => {
    const view = render(panel());
    fireEvent.change(screen.getByTestId('book-edit-title-input'), {
      target: { value: '  Updated  ' },
    });
    fireEvent.change(screen.getByTestId('book-edit-author-input'), {
      target: { value: '  Writer  ' },
    });
    fireEvent.submit(screen.getByTestId('book-edit-form'));
    expect(fixture.update).toHaveBeenCalledWith(
      { bookId: 1, title: 'Updated', author: 'Writer' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    view.rerender(panel());
    expect(screen.getByTestId('book-edit-title-input')).toHaveValue('  Updated  ');
    fixture.book = { bookId: 1, title: 'Updated', author: 'Writer' };
    act(() => fixture.update.mock.calls[0][1].onSuccess());
    view.rerender(panel());
    expect(screen.getByTestId('book-edit-title-input')).toHaveValue('Updated');
    fireEvent.change(screen.getByTestId('book-edit-title-input'), { target: { value: '  ' } });
    fireEvent.submit(screen.getByTestId('book-edit-form'));
    expect(fixture.update).toHaveBeenCalledOnce();
  });

  it('resets a local draft only when the selected book changes', () => {
    const view = render(panel());
    fireEvent.change(screen.getByTestId('book-edit-title-input'), {
      target: { value: 'Book one draft' },
    });
    fixture.book = { bookId: 2, title: 'Book two', author: 'Other' };
    view.rerender(panel(2));
    expect(screen.getByTestId('book-edit-title-input')).toHaveValue('Book two');
  });

  it('keeps a failed deletion open and navigates only after a successful retry', async () => {
    fixture.remove
      .mockRejectedValueOnce(new Error('delete failed'))
      .mockImplementationOnce((_bookId, callbacks) => {
        callbacks.onSuccess();
        return Promise.resolve();
      });
    render(panel());
    fireEvent.click(screen.getByTestId('book-detail-delete'));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }),
      ).toBeEnabled(),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/book/1');
    expect(useBookSelectionStore.getState().selectedBookId).toBe(1);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(fixture.remove).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('location')).toHaveTextContent('/book/library');
    expect(useBookSelectionStore.getState().selectedBookId).toBeUndefined();
  });
});
