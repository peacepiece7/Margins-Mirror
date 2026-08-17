import type { FormEvent } from 'react';
import type { Persona } from '@/types/api/persona';
import type {
  ModerationEvent,
  ModerationFeedback,
  Question,
  SessionInsight,
  SessionWindowTimeline,
} from '@/types/api/session';
export interface SessionDisplayMessage {
  id: string;
  sessionId: number;
  windowId: number;
  role: string;
  content: string;
  personaId?: number;
  personaDisplayName?: string;
  questionId?: number;
  persistedMessageId?: number;
  createdAt?: string;
}

export type SessionDisplayModerationEvent = ModerationEvent;

export interface DebateWindow {
  title: string;
  windowType: string;
}

export interface DebatePageProps {
  draft: string;
  loading: boolean;
  messages: SessionDisplayMessage[];
  moderationEvents?: SessionDisplayModerationEvent[];
  personas: Persona[];
  selectedPersonas: Persona[];
  showReplySkeleton: boolean;
  sourceAnswer?: SessionInsight;
  sourceQuestion?: Question;
  topic: string;
  window?: DebateWindow;
  onAllReplies: () => void;
  onDraftChange: (draft: string) => void;
  onPersonaReply: (personaId: number) => void;
  onModerationFeedback?: (eventId: number, feedback: ModerationFeedback) => void;
  onSubmit: (event: FormEvent) => void;
}

export interface DebateRoomsPageProps {
  currentWindowId?: number;
  windows: SessionWindowTimeline[];
  onSelectWindow: (window: SessionWindowTimeline) => void;
}
