import type { MarginsPage } from './types';
import { reflectionLoopEnabled } from '@/lib/feature-flags';

export function bookPath(
  page: MarginsPage,
  options: { bookId?: number; insightId?: number; questionId?: number; windowId?: number } = {},
) {
  switch (page) {
    case 'book-list':
      return '/book/library';
    case 'book-detail':
      return options.bookId ? `/book/${options.bookId}` : '/book/library';
    case 'review':
      return options.bookId
        ? `/book/${options.bookId}/${reflectionLoopEnabled ? 'reflection' : 'review'}`
        : '/book/library';
    case 'review-editor':
      if (!options.bookId) return '/book/library';
      if (reflectionLoopEnabled) return `/book/${options.bookId}/reflection`;
      return options.insightId
        ? `/book/${options.bookId}/review/${options.insightId}/edit`
        : `/book/${options.bookId}/review/new`;
    case 'question-answer-editor':
      if (!options.bookId) return '/book/library';
      if (reflectionLoopEnabled) return `/book/${options.bookId}/reflection/interview`;
      return options.questionId
        ? `/book/${options.bookId}/review/questions/${options.questionId}`
        : `/book/${options.bookId}`;
    case 'public-reviews':
      return options.insightId
        ? `/book/public-reviews/${options.insightId}`
        : '/book/public-reviews';
    case 'debate-rooms':
      return options.bookId ? `/book/${options.bookId}/debate-rooms` : '/book/library';
    case 'debate':
      if (!options.bookId) {
        return '/book/library';
      }
      return options.windowId
        ? `/book/${options.bookId}/debate/${options.windowId}`
        : `/book/${options.bookId}/debate`;
    default:
      return '/book/discover';
  }
}
