export type ReflectionVisibility = "PRIVATE" | "PUBLIC";
export type InterviewResponseMode = "ANSWER" | "BOOK_ONLY" | "SKIP";
export type DiscussionNavigation =
  | "RESPOND"
  | "NEXT"
  | "FINISH"
  | "SELECT_PERSPECTIVE"
  | "SKIP_PERSPECTIVE";
export type RefinementMode = "EDITED" | "ACCEPTED_SUGGESTION" | "KEPT";
export type RefinementOutcome =
  | "DEEPENED"
  | "NEW_PERSPECTIVE"
  | "CHANGED"
  | "KEPT";

export type SaveReflectionInput = {
  authorName?: string;
  content: string;
  evidence?: string;
  reviewedOn?: string;
  title?: string;
  visibility?: ReflectionVisibility;
};
export type ReflectionLoop = {
  activeInterviewId?: number | null;
  authorName?: string | null;
  bookId: number;
  currentRevision: { content: string; revisionId: number; version: number };
  evidence?: string | null;
  guideId?: number | null;
  reflectionId: number;
  revisions: { content: string; revisionId: number; version: number }[];
  runId?: number | null;
  runStatus?: "READY" | "ACTIVE" | "COMPLETED" | null;
  sessionId: number;
  reviewedOn?: string | null;
  title: string;
  visibility: ReflectionVisibility;
};
export type ReflectionRouteAuthority = { bookId: number; sessionId: number };
export type ReflectionWorkflowTarget =
  | { id: number; kind: "interview" }
  | { id: number; kind: "guide" }
  | { id: number; kind: "discuss" }
  | { id: number; kind: "refine" };
export type MobileReflectionThread = {
  answeredCount?: number | null;
  bookAuthor?: string | null;
  bookId: number;
  bookTitle: string;
  coverImageUrl?: string | null;
  currentQuestion?: string | null;
  generatedCount?: number | null;
  guideId?: number | null;
  interviewId?: number | null;
  interviewStatus?: string | null;
  lastActivityAt: string;
  reflectionId?: number | null;
  reflectionPreview?: string | null;
  refinementOutcome?: RefinementOutcome | null;
  revisionCount: number;
  runId?: number | null;
  runStatus?: string | null;
  sessionId?: number | null;
  targetAnswers?: number | null;
};
export type MobileReflectionThreadList = { threads: MobileReflectionThread[] };
export type MobileReflectionThreadTarget =
  | { bookId: number; kind: "record"; sessionId?: number }
  | { bookId: number; kind: "reflection"; sessionId: number }
  | { bookId: number; interviewId: number; kind: "interview"; sessionId: number }
  | { bookId: number; guideId: number; kind: "guide" }
  | { bookId: number; kind: "discuss"; runId: number }
  | { bookId: number; kind: "refine"; runId: number };
export type ModerationEvent = {
  createdAt: string;
  decision: "ALLOW" | "REDIRECT" | "REJECT";
  eventId: number;
  fallbackUsed: boolean;
  intent: string;
  personaCalled: boolean;
  reasonCode: string;
  routingOutcome: string;
  sessionId: number;
  suggestedQuestion?: string | null;
  userFeedback?: "RELATED" | "NOT_RELATED" | null;
  windowId: number;
};
export type InterviewQuestion = {
  coverageArea: string;
  question: string;
  questionId: number;
  sensitivity: "LOW" | "MEDIUM" | "HIGH";
  sourceFallback?: boolean;
  sourceExcerpt: string;
  sourceRefId?: number | null;
  sourceStale?: boolean;
  sourceType: string;
  sourceVersion?: string | null;
  status: string;
};
export type ReflectionInterview = {
  answeredCount: number;
  answers: {
    answerRevisionId: number;
    content: string;
    question: string;
    questionId: number;
    version: number;
  }[];
  canGenerateGuide: boolean;
  currentQuestion?: InterviewQuestion | null;
  generatedCount: number;
  guideId?: number | null;
  interviewId: number;
  maxReached: boolean;
  maximumQuestions: number;
  minimumAnswers: number;
  reflectionId: number;
  sourceRevisionId: number;
  skippedCount: number;
  status: string;
  targetAnswers: number;
};
export type GuideBrief = {
  audienceMode: "SELF_AI" | "SMALL_GROUP";
  disclosureMode: "PRIVATE_CONTEXT" | "REFLECTION_ONLY";
  facilitationLevel: "BEGINNER" | "EXPERIENCED" | "EXPERT";
  purpose: "THOUGHT_EXPANSION" | "ISSUE_EXPLORATION" | "DISCUSSION_PREP";
  targetMinutes: 20 | 40 | 60;
};
export type GuideOrigin = "GENERATED" | "USER_EDIT" | "REGENERATED";
export type GuideProjection = "FACILITATOR" | "PARTICIPANT";
export type DiscussionQuestion = {
  expectedMinutes: number;
  followUps: string[];
  intent: string;
  itemId: number;
  order: number;
  priority: "REQUIRED" | "OPTIONAL";
  question: string;
  questionId: number;
  sensitivity: "LOW" | "MEDIUM" | "HIGH";
  skippable: boolean;
  sourceExcerpt?: string | null;
  sourceFallback?: boolean;
  sourceRefId?: number | null;
  sourceStale?: boolean;
  sourceType: string;
  sourceVersion?: string | null;
  stage: string;
};
export type DiscussionGuide = {
  audienceMode: GuideBrief["audienceMode"];
  current: boolean;
  depth: "SIMPLE" | "STANDARD" | "DEEP";
  disclosureMode: GuideBrief["disclosureMode"];
  facilitationLevel: GuideBrief["facilitationLevel"];
  goal: string;
  guideId: number;
  guideVersion: number;
  interviewId: number;
  issues: string[];
  items: DiscussionQuestion[];
  origin: GuideOrigin;
  purpose: GuideBrief["purpose"];
  reflectionId: number;
  runId?: number | null;
  sessionId: number;
  sourceGuideId?: number | null;
  status: string;
  targetMinutes: number;
  currentGuideId?: number | null;
};
export type GuideItemEditInput = {
  expectedMinutes: number;
  followUps: string[];
  intent: string;
  itemId: number;
  question: string;
};
export type EditGuideInput = {
  expectedVersion: number;
  goal: string;
  issues: string[];
  items: GuideItemEditInput[];
};
export type RegenerateGuideInput = {
  brief: GuideBrief;
  expectedVersion: number;
};
export type GuideVersionSummary = {
  createdAt?: string | null;
  current: boolean;
  guideId: number;
  guideVersion: number;
  hasRun: boolean;
  origin: GuideOrigin;
  status: string;
};
export type GuideVersions = {
  currentGuideId?: number | null;
  interviewId: number;
  versions: GuideVersionSummary[];
};
type GuideProjectionBase = {
  bookAuthor?: string | null;
  bookTitle: string;
  current: boolean;
  goal: string;
  guideId: number;
  guideVersion: number;
  issues: string[];
};
export type FacilitatorGuideProjection = GuideProjectionBase & {
  items: {
    expectedMinutes: number;
    followUps: string[];
    intent: string;
    order: number;
    priority: "REQUIRED" | "OPTIONAL";
    privateSource: boolean;
    question: string;
    sensitivity: "LOW" | "MEDIUM" | "HIGH";
    skippable: boolean;
    sourceExcerpt?: string | null;
    sourceFallback?: boolean;
    sourceLabel: string;
    sourceStale?: boolean;
    sourceType: string;
    sourceVersion?: string | null;
    stage: string;
  }[];
  projection: "FACILITATOR";
  targetMinutes: number;
};
export type ParticipantGuideProjection = GuideProjectionBase & {
  items: {
    order: number;
    priority: "REQUIRED" | "OPTIONAL";
    question: string;
    stage: string;
  }[];
  projection: "PARTICIPANT";
};
export type GuideProjectionResponse =
  | FacilitatorGuideProjection
  | ParticipantGuideProjection;
export type GuideMarkdownExport = {
  content: string;
  filename: string;
  guideId: number;
  guideVersion: number;
  projection: GuideProjection;
};
export type DiscussionRun = {
  currentItem?: DiscussionQuestion | null;
  guideId: number;
  perspectiveCandidates?: {
    description?: string | null;
    displayName: string;
    personaId: number;
  }[];
  perspectiveSelectionRequired?: boolean;
  runId: number;
  sessionId: number;
  status: string;
  windowId: number;
};
export type GuidedTurn = {
  currentItem?: DiscussionQuestion | null;
  directorAction?: string | null;
  messages: {
    content: string;
    createdAt?: string | null;
    messageId: number;
    personaId?: number | null;
    role: string;
    windowId: number;
  }[];
  moderation?: {
    decision: "ALLOW" | "REDIRECT" | "REJECT";
    eventId?: number;
    intent?: string;
    reasonCode: string;
    suggestedQuestion?: string | null;
  } | null;
  nextItem?: DiscussionQuestion | null;
  perspectiveCandidates?: { displayName: string; personaId: number }[];
  perspectiveSelectionRequired?: boolean;
  runId: number;
  runStatus: string;
};
export type ReflectionRefinement = {
  currentContent: string;
  initialContent: string;
  perspectiveSummary: string;
  reflectionId: number;
  runId: number;
  suggestedContent?: string | null;
  suggestionStatus: "PENDING" | "READY" | "FAILED";
};
export type ReflectionQuestion = {
  questionId: number;
  questionText: string;
  questionType: string;
  status: string;
  windowId: number;
};
export type ReflectionTimeline = {
  bookAuthor?: string | null;
  bookId: number;
  bookTitle: string;
  insights: {
    authorName?: string;
    content: string;
    evidence?: string;
    insightId: number;
    insightType: string;
    reviewedOn?: string;
    title?: string;
    visibility?: string;
  }[];
  messages: {
    content: string;
    createdAt?: string | null;
    messageId: number;
    personaId?: number | null;
    questionId?: number;
    role: string;
    windowId: number;
  }[];
  moderationEvents: ModerationEvent[];
  questions: ReflectionQuestion[];
  sessionId: number;
  windows: { title: string; windowId: number; windowType: string }[];
};
export type QuestionList = { questions: ReflectionQuestion[] };
export type QuestionWindow = {
  sessionId: number;
  title: string;
  windowId: number;
  windowType: string;
};
