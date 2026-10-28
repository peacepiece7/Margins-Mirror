import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { SaveBookResponse } from '@/types/api/book';
import { I18nProvider } from '@/lib/i18n';

import { BookHeader } from './BookHeader';

const book: SaveBookResponse = {
  bookId: 42,
  title: 'Dune',
  author: 'Frank Herbert',
  readingStatus: 'reading',
};

describe('BookHeader', () => {
  it('links the current-book summary title to its existing detail route', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <BookHeader book={book} />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('current-book-title')).toHaveAttribute('href', '/book/42');
    expect(screen.getByTestId('current-book-status')).toHaveTextContent('Currently reading');
    expect(screen.getByTestId('current-book-cover-placeholder')).toHaveAttribute(
      'data-ui',
      'book-transition-cover',
    );
  });
});
