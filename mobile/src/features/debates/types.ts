export type Persona = {
  description?: string;
  displayName: string;
  name: string;
  personaId: number;
  tone?: string;
};
export type PersonaList = { personas: Persona[] };
export type PersonaInput = {
  description?: string;
  displayName: string;
  systemPrompt: string;
  tone?: string;
};
export type BookDebateSession = { sessionId: number; title: string };
export type DebateWindow = {
  personaIds: number[];
  sessionId: number;
  sourceQuestionId?: number;
  status: string;
  title: string;
  windowId: number;
  windowType: string;
};
export type DebateResponseStructure = {
  alternativeLens?: string;
  claim?: string;
  nextQuestion?: string;
  support?: string;
};
export type AiMessage = {
  aiModel?: string;
  content: string;
  createdAt?: string;
  messageId: number;
  messageOrder?: number;
  personaId?: number;
  questionId?: number;
  role: string;
  sessionId?: number;
  streamingReady?: boolean;
  structure?: DebateResponseStructure;
  windowId: number;
};
export type DebateTurn = {
  messages: AiMessage[];
  moderation?: {
    decision: "ALLOW" | "REDIRECT" | "REJECT";
    eventId: number;
    reasonCode: string;
    suggestedQuestion?: string | null;
  } | null;
};
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
export type DebateTimeline = {
  bookId: number;
  insights: {
    content: string;
    insightId: number;
    insightType: string;
    questionId?: number;
  }[];
  messages: (AiMessage & { messageOrder: number })[];
  moderationEvents: ModerationEvent[];
  questions: {
    questionId: number;
    questionText: string;
    status: string;
    windowId: number;
  }[];
  sessionId: number;
  windows: DebateWindow[];
};
