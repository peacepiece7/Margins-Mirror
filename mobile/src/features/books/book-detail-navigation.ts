import type { BookDebateRecommendation } from '@/features/books/types';

export function bookDebateRoute(
  bookId: number,
  recommendation?: BookDebateRecommendation,
) {
  return {
    params: {
      bookId,
      personaKeys: recommendation?.personaKeys.join(','),
      topic: recommendation?.topic,
    },
    pathname: '/books/[bookId]/debates' as const,
  };
}
