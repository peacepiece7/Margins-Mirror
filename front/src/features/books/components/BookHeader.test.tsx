import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { SaveBookResponse } from '@/types/api/book';

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
        <BookHeader book={book} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('current-book-title')).toHaveAttribute('href', '/book/42');
  });
});
