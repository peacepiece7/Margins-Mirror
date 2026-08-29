export interface BookCandidate {
  candidateId: string;
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
  title: string;
  subtitle?: string;
  author: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  publishedYear?: number;
  description?: string;
  thumbnail?: string;
  language?: string;
  pageCount?: number;
  reason?: string;
}

export interface BookCandidateSearchResponse {
  candidates: BookCandidate[];
  page?: number;
  limit?: number;
  totalItems?: number;
  hasMore?: boolean;
}

export interface SaveBookResponse {
  bookId: number;
  title: string;
  subtitle?: string;
  author: string;
  publisher?: string;
  publishedYear?: number;
  isbn?: string;
  source?: string;
  sourceRef?: string;
  coverImageUrl?: string;
  language?: string;
  readingStatus?: string;
  rating?: number;
  statusStartedAt?: string;
  statusFinishedAt?: string;
  updatedAt?: string;
}

export interface BookListResponse {
  books: SaveBookResponse[];
}

export interface BookKnowledgeDiscussionPoint {
  id: string;
  question: string;
  rationale?: string;
  recommendedPersonaKeys?: string[];
}

export interface BookKnowledgeRecommendedPersona {
  discussionPointId: string;
  personaKeys: string[];
}

export interface BookKnowledge {
  knowledgeId: number;
  isbn?: string;
  title: string;
  author?: string;
  summary?: string;
  themes: string[];
  discussionPoints: BookKnowledgeDiscussionPoint[];
  recommendedPersonas: BookKnowledgeRecommendedPersona[];
  famousQuotes: string[];
  keywords: string[];
  version: string;
  generationLocale: 'ko' | 'en';
  status: string;
  generatedAt?: string;
  stale?: boolean;
  fallbackUsed?: boolean;
  refreshPending?: boolean;
}
