import type { ApiClient } from '@/shared/api/client';

import { createBooksApi } from './api';

// BDD: FRONT-046

// BDD: BOOK-019
describe('books api', () => {
  it('saves a catalog candidate with its selected initial shelf state', async () => {
    const client = { post: jest.fn() } as unknown as ApiClient;
    const api = createBooksApi(client);

    await api.save({
      author: 'Frank Herbert',
      candidateId: 'google:9780441172719',
      isbn13: '9780441172719',
      language: 'en',
      title: 'Dune',
    }, 'reading');

    expect(client.post).toHaveBeenCalledWith('/api/books', expect.objectContaining({
      author: 'Frank Herbert',
      candidateId: 'google:9780441172719',
      isbn13: '9780441172719',
      language: 'en',
      readingStatus: 'reading',
      title: 'Dune',
    }));
  });

  it('keeps the historical want-to-read default and forwards optional manual ISBN', async () => {
    const client = { post: jest.fn() } as unknown as ApiClient;
    const api = createBooksApi(client);

    await api.save({ author: 'Reader', candidateId: 'catalog:1', title: 'Book' });
    await api.saveManual('Manual Book', 'Reader', '9788996991342');

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/api/books',
      expect.objectContaining({ readingStatus: 'want_to_read' }),
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/api/books',
      expect.objectContaining({
        author: 'Reader',
        isbn: '9788996991342',
        title: 'Manual Book',
      }),
    );
  });
});
