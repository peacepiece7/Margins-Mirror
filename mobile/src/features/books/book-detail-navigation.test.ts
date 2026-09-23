import { bookDebateRoute } from './book-detail-navigation';

// BDD: FRONT-166 then-2
// BDD: FRONT-167 then-1/then-2
it('carries the selected Book Knowledge topic and normalized persona defaults into debate navigation', () => {
  expect(bookDebateRoute(4, {
    personaKeys: ['literary-critic', 'historical-context'],
    topic: 'What makes fear useful?',
  })).toEqual({
    params: {
      bookId: 4,
      personaKeys: 'literary-critic,historical-context',
      topic: 'What makes fear useful?',
    },
    pathname: '/books/[bookId]/debates',
  });
});
