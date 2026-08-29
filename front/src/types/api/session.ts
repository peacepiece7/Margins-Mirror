export interface CreateReadingSessionResponse {
  sessionId: number;
  bookId: number;
  title: string;
}

export interface BookReadingSessionResponse {
  sessionId: number;
  title: string;
}

export interface CreateSessionWindowResponse {
  windowId: number;
  sessionId: number;
  sourceQuestionId?: number;
  windowType: string;
  title: string;
  status: string;
  /** Persisted room participants, in selection order. Empty means no stored selection. */
  personaIds: number[];
}

export interface AiMessageResponse {
  messageId: number;
  windowId: number;
  personaId?: number;
  role: string;
  content: string;
  streamingReady: boolean;
  aiModel: string;
}

export type ModerationDecision = 'ALLOW' | 'REDIRECT' | 'REJECT';
export type ModerationFeedback = 'RELATED' | 'NOT_RELATED';

export interface ModerationEvent {
  eventId: number;
  sessionId: number;
  windowId: number;
  decision: ModerationDecision;
  intent: string;
  reasonCode: string;
  suggestedQuestion?: string | null;
  fallbackUsed: boolean;
  routingOutcome: string;
  personaCalled: boolean;
  userFeedback?: ModerationFeedback | null;
  createdAt: string;
}

export interface DebateTurnResponse {
  moderation?: ModerationEvent | null;
  messages: AiMessageResponse[];
}

export interface SessionWindowTimeline {
  windowId: number;
  sessionId: number;
  sourceQuestionId?: number;
  windowType: string;
  title: string;
  position: number;
  status: string;
  /** Persisted room participants, in selection order. Empty means legacy/unselected room. */
  personaIds: number[];
}

export interface SessionMessage {
  messageId: number;
  sessionId: number;
  windowId: number;
  parentMessageId?: number;
  role: string;
  content: string;
  messageOrder: number;
  aiModel?: string;
  personaId?: number;
  questionId?: number;
  streamingStatus: string;
  createdAt: string;
}

export interface Question {
  questionId: number;
  sessionId: number;
  windowId: number;
  questionText: string;
  questionType: string;
  status: string;
  aiModel?: string;
}

export interface QuestionListResponse {
  questions: Question[];
}

export interface SessionHighlight {
  highlightId: number;
  sessionId: number;
  bookId: number;
  pageNumber?: number;
  locationLabel?: string;
  quoteText: string;
  note?: string;
  highlightOrder: number;
}

export interface SessionTag {
  tagId: number;
  sessionId: number;
  label: string;
}

export interface SessionInsight {
  insightId: number;
  sessionId: number;
  questionId?: number;
  insightType: string;
  title?: string;
  content: string;
  evidence?: string;
  authorName?: string;
  visibility?: 'PUBLIC' | 'PRIVATE' | string;
  reviewedOn?: string;
  createdAt?: string;
  updatedAt?: string;
  insightOrder: number;
}

export interface ReadingSessionTimelineResponse {
  sessionId: number;
  bookId: number;
  bookTitle: string;
  bookAuthor?: string | null;
  title: string;
  stats: ReadingSessionStats;
  nextActions: ReadingSessionNextAction[];
  windows: SessionWindowTimeline[];
  highlights: SessionHighlight[];
  tags: SessionTag[];
  insights: SessionInsight[];
  questions: Question[];
  messages: SessionMessage[];
  moderationEvents: ModerationEvent[];
}

export interface ReadingSessionNextAction {
  actionId: string;
  label: string;
  detail: string;
  targetWindowId?: number;
  targetQuestionId?: number;
}

export interface ReadingSessionStats {
  windowCount: number;
  questionCount: number;
  answeredQuestionCount: number;
  messageCount: number;
  personaResponseCount: number;
  personaCount: number;
}

export interface SessionSearchResult {
  sessionId: number;
  sourceId: number;
  resultType: string;
  bookTitle: string;
  sessionTitle: string;
  snippet: string;
}

export interface SessionSearchResponse {
  query: string;
  results: SessionSearchResult[];
}

export interface PublicReview {
  insightId: number;
  sessionId: number;
  bookId: number;
  bookTitle: string;
  bookAuthor?: string | null;
  sessionTitle: string;
  title?: string | null;
  content: string;
  evidence?: string | null;
  authorName?: string | null;
  reviewedOn?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PublicReviewListResponse {
  reviews: PublicReview[];
}

export interface ReviewComment {
  commentId: number;
  insightId: number;
  parentCommentId?: number | null;
  authorName?: string | null;
  content: string;
  ownedByCurrentReader: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ReviewCommentListResponse {
  insightId: number;
  comments: ReviewComment[];
}

export interface MetricSnapshotResponse {
  metricId: number;
  sessionId: number;
  metricName: string;
  metricValue?: number | null;
  metricUnit?: string | null;
  windowCount: number;
  questionCount: number;
  answeredQuestionCount: number;
  highlightCount: number;
  messageCount: number;
  personaCount: number;
}
