import { create } from 'zustand';
import type { BookShelfSort, BookShelfStatusFilter } from './types';

type BookSelectionState = {
  selectedBookId?: number;
  shelfFilter: BookShelfStatusFilter;
  shelfSort: BookShelfSort;
  selectBook: (bookId?: number) => void;
  setShelfFilter: (filter: BookShelfStatusFilter) => void;
  setShelfSort: (sort: BookShelfSort) => void;
};

export const useBookSelectionStore = create<BookSelectionState>((set) => ({
  selectedBookId: undefined,
  shelfFilter: 'all',
  shelfSort: 'recent',
  selectBook: (selectedBookId) => set({ selectedBookId }),
  setShelfFilter: (shelfFilter) => set({ shelfFilter }),
  setShelfSort: (shelfSort) => set({ shelfSort }),
}));
