import { useMemo } from "react";

import { useApiClient } from "@/shared/api/api-client-provider";
import type { ApiClient } from "@/shared/api/client";
import type { SseEvent } from "@/shared/api/sse";

import type {
  AiMessage,
  BookDebateSession,
  DebateTimeline,
  DebateTurn,
  DebateWindow,
  PersonaInput,
  PersonaList,
} from "./types";

export function createDebatesApi(client: ApiClient) {
  return {
    archiveWindow(windowId: number) {
      return client.delete<DebateWindow>(`/api/session-windows/${windowId}`);
    },
    createWindow(sessionId: number, title: string, personaIds: number[]) {
      return client.post<DebateWindow>("/api/session-windows", {
        personaIds,
        sessionId,
        title,
        windowType: "debate",
      });
    },
    createPersona(persona: PersonaInput) {
      return client.post<PersonaList>("/api/personas", persona);
    },
    debate(windowId: number, content: string, personaId: number) {
      return client.post<DebateTurn>(
        `/api/session-windows/${windowId}/debate`,
        { content, personaId },
      );
    },
    debateAll(windowId: number, content: string, personaIds: number[]) {
      return client.post<DebateTurn>(
        `/api/session-windows/${windowId}/debate/all`,
        { content, personaIds },
      );
    },
    ensureQuestionDebateWindow(questionId: number) {
      return client.put<DebateWindow>(`/api/questions/${questionId}/debate-window`);
    },
    moderationFeedback(
      eventId: number,
      feedback: "RELATED" | "NOT_RELATED",
    ) {
      return client.post<import("./types").ModerationEvent>(
        `/api/moderation-events/${eventId}/feedback`,
        { feedback },
      );
    },
    personas() {
      return client.get<PersonaList>("/api/personas");
    },
    recommendations(bookId: number) {
      return client.get<PersonaList>(
        `/api/personas/recommendations?bookId=${encodeURIComponent(bookId)}`,
      );
    },
    readingSession(bookId: number) {
      return client.get<BookDebateSession | null>(
        `/api/books/${bookId}/reading-session`,
      );
    },
    timeline(sessionId: number) {
      return client.get<DebateTimeline>(`/api/reading-sessions/${sessionId}`);
    },
    updateMessage(messageId: number, content: string) {
      return client.patch<AiMessage>(`/api/messages/${messageId}`, { content });
    },
    deleteMessage(messageId: number) {
      return client.delete<AiMessage>(`/api/messages/${messageId}`);
    },
    updateWindowTitle(windowId: number, title: string) {
      return client.patch<DebateWindow>(
        `/api/session-windows/${windowId}/title`,
        { title },
      );
    },
    streamMessage(
      windowId: number,
      content: string,
      onEvent?: (event: SseEvent) => void,
      signal?: AbortSignal,
    ) {
      return client.stream<AiMessage>(
        `/api/session-windows/${windowId}/messages/stream`,
        { content },
        onEvent,
        signal,
      );
    },
  };
}

export function useDebatesApi() {
  const client = useApiClient();
  return useMemo(() => createDebatesApi(client), [client]);
}
