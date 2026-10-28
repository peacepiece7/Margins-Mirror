export type BookReadingSession = { sessionId: number; title: string };
export type CreatedReadingSession = {
  bookId: number;
  sessionId: number;
  title: string;
};
export type SessionWindow = {
  personaIds: number[];
  position: number;
  sessionId: number;
  sourceQuestionId?: number;
  status: string;
  title: string;
  windowId: number;
  windowType: string;
};
export type SessionWindowMutation = Omit<SessionWindow, "position"> & {
  position?: number;
};
export type SessionMessage = {
  content: string;
  createdAt: string;
  messageId: number;
  messageOrder: number;
  parentMessageId?: number;
  personaId?: number;
  questionId?: number;
  role: string;
  sessionId: number;
  streamingStatus: string;
  windowId: number;
};
export type SessionQuestion = {
  questionId: number;
  questionText: string;
  questionType: string;
  sessionId: number;
  status: string | null;
  windowId: number;
};
export type SessionHighlight = {
  highlightId: number;
  locationLabel?: string;
  note?: string;
  pageNumber?: number;
  quoteText: string;
};
export type SessionInsight = {
  authorName?: string;
  content: string;
  evidence?: string;
  insightId: number;
  reviewedOn?: string;
  title?: string;
  visibility?: string;
};
export type InsightInput = {
  authorName?: string;
  content: string;
  evidence?: string;
  insightType?: string;
  reviewedOn?: string;
  title?: string;
  visibility?: string;
};
export type SessionSearchResult = {
  bookId: number;
  bookTitle: string;
  resultType: string;
  sessionId: number;
  sessionTitle: string;
  snippet: string;
  sourceId: number;
};
export type SessionSearchResponse = { query: string; results: SessionSearchResult[] };
export type QuestionList = { questions: SessionQuestion[] };
export type MetricSnapshot = {
  answeredQuestionCount: number;
  highlightCount: number;
  messageCount: number;
  metricId: number;
  metricName: string;
  metricUnit?: string | null;
  metricValue?: number | null;
  personaCount: number;
  questionCount: number;
  sessionId: number;
  windowCount: number;
};
export type ReadingSessionTimeline = {
  bookAuthor?: string | null;
  bookId: number;
  bookTitle: string;
  highlights: SessionHighlight[];
  insights: SessionInsight[];
  messages: SessionMessage[];
  questions: SessionQuestion[];
  sessionId: number;
  stats: {
    answeredQuestionCount: number;
    messageCount: number;
    personaCount: number;
    personaResponseCount: number;
    questionCount: number;
    windowCount: number;
  };
  tags: { label: string; tagId: number }[];
  title: string;
  windows: SessionWindow[];
};
export type HighlightInput = {
  locationLabel?: string;
  note?: string;
  pageNumber?: number;
  quoteText: string;
};
