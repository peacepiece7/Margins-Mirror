type BookListKeyInput = {
  status?: string;
  sort?: string;
};

export const protectedQueryRoots = {
  account: ['account'] as const,
  memoryCards: ['memory-cards'] as const,
  reading: ['reading'] as const,
};

export const bookKeys = {
  all: [...protectedQueryRoots.reading, 'books'] as const,
  lists: () => [...bookKeys.all, 'list'] as const,
  list: (query: BookListKeyInput = {}) => [...bookKeys.lists(), query] as const,
  searches: () => [...bookKeys.all, 'search'] as const,
  search: (query: string, limit: number) => [...bookKeys.searches(), query, limit] as const,
  searchCommand: () => [...bookKeys.searches(), 'command'] as const,
  details: () => [...bookKeys.all, 'detail'] as const,
  detail: (bookId: number) => [...bookKeys.details(), bookId] as const,
  knowledge: (bookId: number, preferredLocale: 'ko' | 'en') =>
    [...bookKeys.detail(bookId), 'knowledge', preferredLocale] as const,
};

export const sessionKeys = {
  all: [...protectedQueryRoots.reading, 'sessions'] as const,
  books: () => [...sessionKeys.all, 'book'] as const,
  book: (bookId: number) => [...sessionKeys.books(), bookId] as const,
  latest: () => [...sessionKeys.all, 'latest'] as const,
  timelines: () => [...sessionKeys.all, 'timeline'] as const,
  timeline: (sessionId: number) => [...sessionKeys.timelines(), sessionId] as const,
  search: (query: string) => [...sessionKeys.all, 'search', query] as const,
};

export const personaKeys = {
  all: [...protectedQueryRoots.reading, 'personas'] as const,
  lists: () => [...personaKeys.all, 'list'] as const,
  list: () => [...personaKeys.lists(), 'all'] as const,
  recommendations: () => [...personaKeys.all, 'recommendation'] as const,
  recommendation: (bookId: number) => [...personaKeys.recommendations(), bookId] as const,
};

export const publicReviewKeys = {
  all: [...protectedQueryRoots.reading, 'public-reviews'] as const,
  lists: () => [...publicReviewKeys.all, 'list'] as const,
  list: () => [...publicReviewKeys.lists(), 'all'] as const,
  comments: (insightId: number) => [...publicReviewKeys.all, 'comments', insightId] as const,
};

export const reflectionLoopKeys = {
  all: [...protectedQueryRoots.reading, 'reflection-loop'] as const,
  reflections: () => [...reflectionLoopKeys.all, 'reflection'] as const,
  reflection: (reflectionId: number) =>
    [...reflectionLoopKeys.reflections(), reflectionId] as const,
  sessionReflection: (sessionId: number) =>
    [...reflectionLoopKeys.reflections(), 'session', sessionId] as const,
  interviews: () => [...reflectionLoopKeys.all, 'interview'] as const,
  interview: (interviewId: number) => [...reflectionLoopKeys.interviews(), interviewId] as const,
  guides: () => [...reflectionLoopKeys.all, 'guide'] as const,
  guide: (guideId: number) => [...reflectionLoopKeys.guides(), guideId] as const,
  guideProjection: (guideId: number, projection: 'FACILITATOR' | 'PARTICIPANT') =>
    [...reflectionLoopKeys.guide(guideId), 'projection', projection] as const,
  guideVersions: (interviewId: number) =>
    [...reflectionLoopKeys.guides(), 'interview', interviewId, 'versions'] as const,
  runs: () => [...reflectionLoopKeys.all, 'run'] as const,
  run: (runId: number) => [...reflectionLoopKeys.runs(), runId] as const,
  refinement: (runId: number) => [...reflectionLoopKeys.run(runId), 'refinement'] as const,
};

export const readingQueryKey = protectedQueryRoots.reading;
