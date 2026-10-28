import { createServer } from 'node:http';

export async function startGoogleBooksStub() {
  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (request.method !== 'GET' || !['/books/v1/volumes', '/search.json'].includes(url.pathname)) {
      response.writeHead(404).end();
      return;
    }
    const query = (url.searchParams.get('q') || '').toLowerCase();
    const payload = query.includes('dune')
      ? {
          totalItems: 1,
          items: [
            {
              id: 'e2e-dune',
              volumeInfo: {
                title: 'Dune',
                authors: ['Frank Herbert'],
                publisher: 'Ace',
                publishedDate: '1965',
                industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780441172719' }],
                language: 'en',
              },
            },
          ],
        }
      : { totalItems: 0, items: [] };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    const result = url.pathname === '/search.json'
      ? { numFound: payload.totalItems, docs: (payload.items || []).map(({ volumeInfo }) => ({
          key: '/works/e2e-dune', title: volumeInfo.title, author_name: volumeInfo.authors,
          first_publish_year: 1965,
        })) }
      : payload;
    response.end(JSON.stringify(result));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Google Books E2E stub did not expose a TCP port.');
  }
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}
