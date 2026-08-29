import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';
import { postStream } from '@/lib/sse-client';
import type {
  AiMessageResponse,
  BookReadingSessionResponse,
  CreateSessionWindowResponse,
  ReadingSessionTimelineResponse,
  DebateTurnResponse,
  ModerationEvent,
  ModerationFeedback,
  SessionMessage,
} from '@/types/api/session';
import type { PersonaListResponse } from '@/types/api/persona';

export interface PersonaInput {
  displayName: string;
  description?: string;
  systemPrompt: string;
  tone?: string;
}

export const debatesApi = {
  readingSession(bookId: number): Promise<BookReadingSessionResponse | null> {
    return getJson(`/api/books/${bookId}/reading-session`);
  },

  timeline(sessionId: number): Promise<ReadingSessionTimelineResponse | null> {
    return getJson(`/api/reading-sessions/${sessionId}`);
  },

  personas(): Promise<PersonaListResponse> {
    return getJson('/api/personas');
  },

  recommendations(bookId: number): Promise<PersonaListResponse> {
    return getJson(`/api/personas/recommendations?bookId=${encodeURIComponent(bookId)}`);
  },

  createPersona(persona: PersonaInput): Promise<PersonaListResponse> {
    return postJson('/api/personas', persona);
  },

  createWindow(
    sessionId: number,
    windowType = 'question',
    title = 'Reflection Window',
    personaIds?: number[],
  ): Promise<CreateSessionWindowResponse> {
    return postJson('/api/session-windows', {
      sessionId,
      windowType,
      title,
      ...(personaIds ? { personaIds } : {}),
    });
  },

  updateWindowTitle(windowId: number, title: string): Promise<CreateSessionWindowResponse> {
    return patchJson(`/api/session-windows/${windowId}/title`, { title });
  },

  archiveWindow(windowId: number): Promise<CreateSessionWindowResponse> {
    return deleteJson(`/api/session-windows/${windowId}`);
  },

  sendMessage(windowId: number, content: string, questionId?: number): Promise<AiMessageResponse> {
    return postJson(`/api/session-windows/${windowId}/messages`, { content, questionId });
  },

  streamMessage(
    windowId: number,
    content: string,
    questionId: number | undefined,
    onDelta: (delta: string) => void,
  ): Promise<AiMessageResponse> {
    return postStream<AiMessageResponse>(
      `/api/session-windows/${windowId}/messages/stream`,
      { content, questionId },
      (event) => {
        if (event.event === 'message.delta') {
          onDelta((event.data as { delta?: string }).delta || '');
        }
      },
    );
  },

  updateMessage(messageId: number, content: string): Promise<SessionMessage> {
    return patchJson(`/api/messages/${messageId}`, { content });
  },

  deleteMessage(messageId: number): Promise<SessionMessage> {
    return deleteJson(`/api/messages/${messageId}`);
  },

  debate(windowId: number, personaId: number, content: string): Promise<DebateTurnResponse> {
    return postJson(`/api/session-windows/${windowId}/debate`, { personaId, content });
  },

  debateAll(windowId: number, content: string, personaIds?: number[]): Promise<DebateTurnResponse> {
    return postJson(`/api/session-windows/${windowId}/debate/all`, { content, personaIds });
  },

  moderationFeedback(eventId: number, feedback: ModerationFeedback): Promise<ModerationEvent> {
    return postJson(`/api/moderation-events/${eventId}/feedback`, { feedback });
  },
};
