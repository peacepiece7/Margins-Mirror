import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';
import type { SaveBookResponse } from '@/types/api/book';

import { BookListPage } from './BookListPage';

const books: SaveBookResponse[] = [
  { bookId: 101, title: 'Margins', author: 'Author One', readingStatus: 'reading' },
  { bookId: 102, title: 'Clear Controls', author: 'Author Two', readingStatus: 'want_to_read' },
];

function library(loading = false) {
  return (
    <I18nProvider>
      <MemoryRouter>
        <BookListPage
          books={books}
          loading={loading}
          onDelete={vi.fn()}
          onRatingChange={vi.fn()}
          onSelect={vi.fn()}
          onSortChange={vi.fn()}
          onStatusChange={vi.fn()}
          sort="recent"
        />
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => localStorage.setItem('margins.locale', 'ko'));
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('BookListPage control clarity', () => {
  it('opts the saved-book title into the data-router view transition', async () => {
    const original = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
    const startViewTransition = vi.fn((update: () => void | Promise<void>) => {
      const updateCallbackDone = Promise.resolve().then(update);
      return {
        finished: updateCallbackDone,
        ready: Promise.resolve(),
        skipTransition: vi.fn(),
        updateCallbackDone,
      };
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    const router = createMemoryRouter(
      [
        {
          path: '/book/library',
          element: (
            <BookListPage
              books={books}
              loading={false}
              onDelete={vi.fn()}
              onRatingChange={vi.fn()}
              onSelect={vi.fn()}
              onSortChange={vi.fn()}
              onStatusChange={vi.fn()}
              sort="recent"
            />
          ),
        },
        { path: '/book/:bookId', element: <div data-testid="transition-detail" /> },
      ],
      { initialEntries: ['/book/library'] },
    );

    try {
      render(
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>,
      );
      fireEvent.click(screen.getAllByTestId('saved-book-detail-link')[0]);

      expect(await screen.findByTestId('transition-detail')).toBeInTheDocument();
      expect(startViewTransition).toHaveBeenCalledOnce();
    } finally {
      if (original) Object.defineProperty(document, 'startViewTransition', original);
      else Reflect.deleteProperty(document, 'startViewTransition');
    }
  });

  it('gives sort and every reading-status field unique identification without losing its label', () => {
    const { container } = render(library());
    const sort = screen.getByTestId('book-shelf-sort');

    expect(sort.id).toMatch(/^book-shelf-sort-/);
    expect(sort).toHaveAttribute('name', 'book-shelf-sort');
    expect(sort).toHaveAccessibleName();

    for (const book of books) {
      const trigger = screen.getByTestId(`saved-book-status-${book.bookId}`);

      expect(trigger.id).toMatch(new RegExp(`^book-status-${book.bookId}-`));
      expect(trigger).toHaveAccessibleName();
    }

    const ids = Array.from(container.querySelectorAll('[id]'), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    const nativeFields = Array.from(container.querySelectorAll('select'));
    expect(nativeFields).toHaveLength(1);
    expect(nativeFields[0].id).toBe(sort.id);
    expect(nativeFields[0]).toHaveAttribute('name', 'book-shelf-sort');
    expect(nativeFields.filter((field) => !field.id && !field.name)).toHaveLength(0);
  });

  it('keeps ids unique when the same library is mounted twice in inline Docs', () => {
    const { container } = render(
      <>
        {library()}
        {library()}
      </>,
    );
    const ids = Array.from(container.querySelectorAll('[id]'), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sort of screen.getAllByTestId('book-shelf-sort')) {
      expect(sort).toHaveAccessibleName();
      expect(sort).toHaveAttribute('name', 'book-shelf-sort');
    }
  });

  it('keeps native sorting interactive and exposes the destructive delete state at rest and on focus', () => {
    const onDelete = vi.fn();
    const onSortChange = vi.fn();
    const view = render(
      <I18nProvider>
        <MemoryRouter>
          <BookListPage
            books={books}
            loading={false}
            onDelete={onDelete}
            onRatingChange={vi.fn()}
            onSelect={vi.fn()}
            onSortChange={onSortChange}
            onStatusChange={vi.fn()}
            sort="recent"
          />
        </MemoryRouter>
      </I18nProvider>,
    );
    const sort = screen.getByTestId('book-shelf-sort');
    fireEvent.change(sort, { target: { value: 'title_asc' } });
    expect(onSortChange).toHaveBeenCalledWith('title_asc');

    const deleteButton = screen.getByRole('button', { name: 'Margins 삭제' });
    expect(deleteButton).toHaveClass('bg-destructive/10');
    expect(deleteButton).toHaveClass('hover:bg-destructive/20');
    expect(deleteButton).toHaveClass('focus-visible:border-destructive/40');
    expect(deleteButton).toHaveClass('focus-visible:ring-destructive/20');
    deleteButton.focus();
    expect(deleteButton).toHaveFocus();
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith(books[0]);

    view.rerender(
      <I18nProvider>
        <MemoryRouter>
          <BookListPage
            books={books}
            loading
            onDelete={onDelete}
            onRatingChange={vi.fn()}
            onSelect={vi.fn()}
            onSortChange={onSortChange}
            onStatusChange={vi.fn()}
            sort="recent"
          />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: 'Margins 삭제' })).toBeDisabled();
    expect(screen.getByTestId('saved-book-status-101')).toBeDisabled();
  });
});
