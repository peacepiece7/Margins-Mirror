export type BookReadingStatus = 'want_to_read' | 'reading' | 'read' | 'dnf';

export type BookShelfStatusFilter = 'all' | BookReadingStatus;

export type BookShelfSort =
  'recent' | 'title_asc' | 'title_desc' | 'rating_desc' | 'rating_asc' | 'status';

export type MarginsPage =
  | 'book-search'
  | 'book-list'
  | 'book-detail'
  | 'review'
  | 'review-editor'
  | 'question-answer-editor'
  | 'public-reviews'
  | 'debate-rooms'
  | 'debate';

export interface BookShelfQuery {
  status?: BookShelfStatusFilter;
  sort?: BookShelfSort;
}

export const BOOK_READING_STATUSES: BookReadingStatus[] = [
  'want_to_read',
  'reading',
  'read',
  'dnf',
];

export const BOOK_SHELF_SORTS: BookShelfSort[] = [
  'recent',
  'title_asc',
  'title_desc',
  'rating_desc',
  'rating_asc',
  'status',
];
