import type { BookCandidate, SaveBookResponse } from '@/types/api/book';
import type { CatalogSearchRequest } from '@/types/api/catalog';

import type { BookReadingStatus, BookShelfSort } from './types';

export interface CatalogSearchFormProps {
  active: CatalogSearchRequest;
  onSearch: (request: CatalogSearchRequest) => void;
  onFilterChange: (request: CatalogSearchRequest) => void;
  onClear: () => void;
}

export type BookInfoDraft = Pick<SaveBookResponse, 'title' | 'author'>;

export interface BookInfoSectionProps {
  book?: SaveBookResponse;
  pending: boolean;
  onSave: (title: string, author: string, onSuccess: () => void) => void;
  onShelfChange: (shelf: {
    readingStatus?: BookReadingStatus;
    rating?: number;
    clearRating?: boolean;
  }) => void;
  onDelete: () => void;
  onReview: () => void;
}

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
  loading: boolean;
  sort: BookShelfSort;
  onDelete: (book: SaveBookResponse) => void;
  onRatingChange: (bookId: number, rating?: number) => void;
  onSelect: (book: SaveBookResponse) => void;
  onSortChange: (sort: BookShelfSort) => void;
  onStatusChange: (bookId: number, status: BookReadingStatus) => void;
}
