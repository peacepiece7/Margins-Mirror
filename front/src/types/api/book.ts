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
  loop?: LibraryLoopSummary;
  recentRevisions?: LibraryRevisionSummary[];
  threadVersion?: string;
}

export interface BookListResponse {
  books: SaveBookResponse[];
  nextCursor?: string;
  summary?: LibrarySummary | null;
}

export type LibraryLoopStage = 'REFLECT' | 'INTERVIEW' | 'GUIDE' | 'DISCUSS' | 'REFINE';

export interface LibraryContinueLocator {
  kind: LibraryLoopStage;
  href: string;
}

export interface LibraryLoopSummary {
  stage: LibraryLoopStage;
  reflectionId?: number;
  currentRevisionId?: number;
  currentRevisionNumber?: number;
  currentRevisionAt?: string;
  interviewId?: number;
  answeredCount: number;
  targetCount: number;
  guideId?: number;
  runId?: number;
  runStatus?: string;
  continueLocator: LibraryContinueLocator;
}

export interface LibraryRevisionSummary {
  revisionId: number;
  version: number;
  revisionSource: string;
  createdAt: string;
}

export interface LibraryThreadItem {
  book: SaveBookResponse;
  loop: LibraryLoopSummary;
  recentRevisions: LibraryRevisionSummary[];
  version: string;
}

export interface LibraryThreadResponse {
  threads: LibraryThreadItem[];
  nextCursor?: string;
  summary?: LibrarySummary | null;
}

export interface LibraryActivitySummary {
  bookId: number;
  bookTitle: string;
  bookAuthor?: string;
  revisionId: number;
  version: number;
  revisionSource: string;
  createdAt: string;
}

export interface LibrarySummary {
  shelfCounts: Partial<Record<'all' | 'want_to_read' | 'reading' | 'read' | 'dnf', number>>;
  stageCounts: Partial<Record<LibraryLoopStage, number>>;
  recentActivity: LibraryActivitySummary[];
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

export interface BookBackground {
  summary: string | null;
  revision: number;
  updatedAt: string | null;
}

export interface UpdateBookBackground {
  summary: string | null;
  expectedRevision: number;
}
