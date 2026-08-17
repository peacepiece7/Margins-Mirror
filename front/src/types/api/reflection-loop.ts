import type { AiMessageResponse, ModerationEvent } from './session';

export type ReflectionVisibility = 'PRIVATE' | 'PUBLIC';
export type InterviewResponseMode = 'ANSWER' | 'BOOK_ONLY' | 'SKIP';
export type InterviewAnswerRevisionKind = 'WORDING_ONLY' | 'RESTART_FROM_HERE';
export type DiscussionNavigation =
  'RESPOND' | 'NEXT' | 'FINISH' | 'SELECT_PERSPECTIVE' | 'SKIP_PERSPECTIVE';
export type RefinementMode = 'EDITED' | 'ACCEPTED_SUGGESTION' | 'KEPT';
export type RefinementOutcome = 'DEEPENED' | 'NEW_PERSPECTIVE' | 'CHANGED' | 'KEPT';
export type GuidePurpose = 'THOUGHT_EXPANSION' | 'ISSUE_EXPLORATION' | 'DISCUSSION_PREP';
export type GuideAudienceMode = 'SELF_AI' | 'SMALL_GROUP';
export type GuideTargetMinutes = 20 | 40 | 60;
export type GuideDisclosureMode = 'PRIVATE_CONTEXT' | 'REFLECTION_ONLY';
export type GuideFacilitationLevel = 'BEGINNER' | 'EXPERIENCED' | 'EXPERT';
export type GuideOrigin = 'GENERATED' | 'USER_EDIT' | 'REGENERATED';
export type DiscussionGuideProjection = 'FACILITATOR' | 'PARTICIPANT';

export interface GuideBriefInput {
  purpose: GuidePurpose;
  audienceMode: GuideAudienceMode;
  targetMinutes: GuideTargetMinutes;
  disclosureMode: GuideDisclosureMode;
  facilitationLevel: GuideFacilitationLevel;
}

export interface SaveReflectionInput {
  content: string;
  title?: string;
  evidence?: string;
  authorName?: string;
  visibility?: ReflectionVisibility;
  reviewedOn?: string;
}

export interface ReflectionRevision {
  revisionId: number;
  version: number;
  content: string;
  revisionSource: string;
  sourceRevisionId?: number | null;
  createdAt?: string | null;
}

export interface ReflectionLoopResponse {
  reflectionId: number;
  sessionId: number;
  visibility: ReflectionVisibility;
  currentRevision: ReflectionRevision;
  revisions: ReflectionRevision[];
  activeInterviewId?: number | null;
  guideId?: number | null;
  runId?: number | null;
  runStatus?: 'READY' | 'ACTIVE' | 'COMPLETED' | null;
}

export interface InterviewQuestion {
  questionId: number;
  question: string;
  coverageArea: string;
  sourceType: string;
  sourceRefId?: number | null;
  sourceExcerpt: string;
  sourceVersion?: string | null;
  sourceStale?: boolean;
  sourceFallback?: boolean;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: string;
}

export interface InterviewAnswer {
  answerRevisionId: number;
  questionId: number;
  question: string;
  content: string;
  version: number;
  responseMode: 'ANSWER';
}

export interface UpdateInterviewAnswerInput {
  expectedAnswerVersion: number;
  content: string;
  revisionKind: InterviewAnswerRevisionKind;
}

export interface ReflectionInterviewResponse {
  interviewId: number;
  parentInterviewId?: number | null;
  forkQuestionId?: number | null;
  reflectionId: number;
  sourceRevisionId: number;
  status: string;
  answeredCount: number;
  skippedCount: number;
  generatedCount: number;
  minimumAnswers: number;
  targetAnswers: number;
  maximumQuestions: number;
  coverage: string[];
  answers: InterviewAnswer[];
  currentQuestion?: InterviewQuestion | null;
  canGenerateGuide: boolean;
  maxReached: boolean;
  guideId?: number | null;
}

export interface DiscussionQuestion {
  itemId: number;
  questionId: number;
  stage: string;
  priority: 'REQUIRED' | 'OPTIONAL';
  order: number;
  question: string;
  intent: string;
  sourceType: string;
  sourceRefId?: number | null;
  sourceExcerpt?: string | null;
  sourceVersion?: string | null;
  sourceStale?: boolean;
  sourceFallback?: boolean;
  privateSource?: boolean;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  skippable: boolean;
  expectedMinutes: number;
  followUps: string[];
}

export interface DiscussionGuideResponse {
  guideId: number;
  reflectionId: number;
  interviewId: number;
  sessionId: number;
  depth: 'SIMPLE' | 'STANDARD' | 'DEEP';
  purpose: GuidePurpose;
  facilitationLevel: GuideFacilitationLevel;
  audienceMode: GuideAudienceMode;
  targetMinutes: GuideTargetMinutes;
  disclosureMode: GuideDisclosureMode;
  goal: string;
  issues: string[];
  status: string;
  guideVersion: number;
  sourceGuideId?: number | null;
  origin: GuideOrigin;
  current: boolean;
  currentGuideId?: number | null;
  items: DiscussionQuestion[];
  runId?: number | null;
}

export interface GuideItemEditInput {
  itemId: number;
  question: string;
  intent: string;
  expectedMinutes: number;
  followUps: string[];
}

export interface EditDiscussionGuideInput {
  expectedVersion: number;
  goal: string;
  issues: string[];
  items: GuideItemEditInput[];
}

export interface RegenerateDiscussionGuideInput {
  expectedVersion: number;
  brief: GuideBriefInput;
}

export interface DiscussionGuideVersionSummary {
  guideId: number;
  guideVersion: number;
  origin: GuideOrigin;
  status: string;
  current: boolean;
  hasRun: boolean;
  createdAt?: string | null;
}

export interface DiscussionGuideVersionsResponse {
  interviewId: number;
  currentGuideId?: number | null;
  versions: DiscussionGuideVersionSummary[];
}

export interface FacilitatorDiscussionQuestion {
  stage: string;
  priority: 'REQUIRED' | 'OPTIONAL';
  order: number;
  question: string;
  intent: string;
  sourceType: string;
  sourceLabel: string;
  sourceExcerpt?: string | null;
  sourceVersion?: string | null;
  sourceStale?: boolean;
  sourceFallback?: boolean;
  privateSource: boolean;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  skippable: boolean;
  expectedMinutes: number;
  followUps: string[];
}

export interface ParticipantDiscussionQuestion {
  stage: string;
  priority: 'REQUIRED' | 'OPTIONAL';
  order: number;
  question: string;
}

interface DiscussionGuideProjectionBase {
  guideId: number;
  guideVersion: number;
  current: boolean;
  bookTitle: string;
  bookAuthor?: string | null;
  goal: string;
  issues: string[];
}

export interface FacilitatorDiscussionGuideProjection extends DiscussionGuideProjectionBase {
  projection: 'FACILITATOR';
  targetMinutes: number;
  items: FacilitatorDiscussionQuestion[];
}

export interface ParticipantDiscussionGuideProjection extends DiscussionGuideProjectionBase {
  projection: 'PARTICIPANT';
  items: ParticipantDiscussionQuestion[];
}

export type DiscussionGuideProjectionResponse =
  FacilitatorDiscussionGuideProjection | ParticipantDiscussionGuideProjection;

export interface DiscussionGuideMarkdownExportResponse {
  projection: DiscussionGuideProjection;
  guideId: number;
  guideVersion: number;
  filename: string;
  content: string;
}

export interface DiscussionRunResponse {
  runId: number;
  guideId: number;
  windowId: number;
  sessionId: number;
  status: string;
  currentItem?: DiscussionQuestion | null;
  lastDirectorAction?: string | null;
  perspectiveCandidates?: PerspectiveCandidate[];
  perspectiveSelectionRequired?: boolean;
}

export interface PerspectiveCandidate {
  personaId: number;
  displayName: string;
  description?: string | null;
}

export interface GuidedDiscussionTurnResponse {
  runId: number;
  runStatus: string;
  moderation?: ModerationEvent | null;
  messages: AiMessageResponse[];
  directorAction?: string | null;
  currentItem?: DiscussionQuestion | null;
  nextItem?: DiscussionQuestion | null;
  perspectiveCandidates?: PerspectiveCandidate[];
  perspectiveSelectionRequired?: boolean;
}

export interface ReflectionRefinementResponse {
  runId: number;
  reflectionId: number;
  initialContent: string;
  currentContent: string;
  perspectiveSummary: string;
  suggestionStatus: 'PENDING' | 'READY' | 'FAILED';
  suggestedContent?: string | null;
}
