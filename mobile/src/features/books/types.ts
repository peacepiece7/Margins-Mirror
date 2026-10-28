export type ReadingStatus = 'dnf' | 'read' | 'reading' | 'want_to_read';
export type BookFilter = 'all' | ReadingStatus;
export type BookSort = 'rating_asc' | 'rating_desc' | 'recent' | 'status' | 'title_asc' | 'title_desc';

export type BookCandidate = {
  author: string;
  authors?: string[];
  candidateId: string;
  description?: string;
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
  language?: string;
  pageCount?: number | null;
  publishedDate?: string;
  publishedYear?: number;
  publisher?: string;
  reason?: string;
  subtitle?: string;
  thumbnail?: string;
  title: string;
};

export type BookCandidateSearchResponse = {
  candidates: BookCandidate[];
  hasMore?: boolean;
  limit?: number;
  page?: number;
  totalItems?: number;
};

export type SavedBook = {
  author: string;
  bookId: number;
  coverImageUrl?: string;
  isbn?: string;
  language?: string;
  publisher?: string;
  publishedYear?: number;
  rating?: number | null;
  readingStatus?: ReadingStatus;
  source?: string;
  sourceRef?: string;
  statusFinishedAt?: string;
  statusStartedAt?: string;
  subtitle?: string;
  title: string;
  updatedAt?: string;
};

export type BookListResponse = { books: SavedBook[] };

export type BookKnowledgeDiscussionPoint = {
  id: string;
  question: string;
  rationale?: string;
  recommendedPersonaKeys?: string[];
};

export type BookKnowledge = {
  author?: string;
  discussionPoints: BookKnowledgeDiscussionPoint[];
  fallbackUsed?: boolean;
  famousQuotes: string[];
  generatedAt?: string;
  isbn?: string;
  keywords: string[];
  knowledgeId: number;
  recommendedPersonas: { discussionPointId: string; personaKeys: string[] }[];
  refreshPending?: boolean;
  stale?: boolean;
  status: string;
  summary?: string;
  themes: string[];
  title: string;
  version: string;
};

export type BookDebateRecommendation = { personaKeys: string[]; topic: string };

export type BookShelfQuery = { sort?: BookSort; status?: BookFilter };
