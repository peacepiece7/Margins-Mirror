import type { BookCandidate, SaveBookResponse } from '@/types/api/book';

import type { BookReadingStatus, BookShelfSort, BookShelfStatusFilter } from './types';

export interface BookSearchPageProps {
  candidateHasMore: boolean;
  candidateTotalItems?: number;
  candidates: BookCandidate[];
  error: boolean;
  loading: boolean;
  loadingMore: boolean;
  query: string;
  saving: boolean;
  loadMoreRef: (node: HTMLDivElement | null) => void;
  onClear: () => void;
  onManualSubmit: (values: { title: string; author: string }) => Promise<void> | void;
  onRetry: () => void;
  onSaveCandidate: (candidate: BookCandidate) => void;
  onSearch: (query: string) => void;
}

export interface BookListPageProps {
  books: SaveBookResponse[];
  filter: BookShelfStatusFilter;
  loading: boolean;
  sort: BookShelfSort;
  onDelete: (book: SaveBookResponse) => void;
  onFilterChange: (filter: BookShelfStatusFilter) => void;
  onRatingChange: (bookId: number, rating?: number) => void;
  onSelect: (book: SaveBookResponse) => void;
  onSortChange: (sort: BookShelfSort) => void;
  onStatusChange: (bookId: number, status: BookReadingStatus) => void;
}
