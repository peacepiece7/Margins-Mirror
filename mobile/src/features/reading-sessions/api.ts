import { useMemo } from "react";

import { useApiClient } from "@/shared/api/api-client-provider";
import type { ApiClient } from "@/shared/api/client";

import type {
  BookReadingSession,
  CreatedReadingSession,
  HighlightInput,
  InsightInput,
  MetricSnapshot,
  ReadingSessionTimeline,
  QuestionList,
  SessionMessage,
  SessionQuestion,
  SessionSearchResponse,
  SessionWindowMutation,
} from "./types";

export function createReadingSessionsApi(client: ApiClient) {
  return {
    archiveSession(sessionId: number) {
      return client.delete<void>(`/api/reading-sessions/${sessionId}`);
    },
    archiveWindow(windowId: number) {
      return client.delete<SessionWindowMutation>(`/api/session-windows/${windowId}`);
    },
    createQuestion(windowId: number, questionText: string) {
      return client.post<QuestionList>(`/api/session-windows/${windowId}/questions`, {
        questionText,
      });
    },
    createSession(bookId: number, title: string) {
      return client.post<CreatedReadingSession>("/api/reading-sessions", {
        bookId,
        title,
      });
    },
    createWindow(sessionId: number, title: string) {
      return client.post<SessionWindowMutation>("/api/session-windows", {
        sessionId,
        title,
        windowType: "question",
      });
    },
    createHighlight(sessionId: number, input: HighlightInput) {
      return client.post<ReadingSessionTimeline>(
        `/api/reading-sessions/${sessionId}/highlights`,
        input,
      );
    },
    createInsight(
      sessionId: number,
      input: InsightInput,
    ) {
      return client.post<ReadingSessionTimeline>(
        `/api/reading-sessions/${sessionId}/insights`,
        input,
      );
    },
    createTag(sessionId: number, label: string) {
      return client.post<ReadingSessionTimeline>(
        `/api/reading-sessions/${sessionId}/tags`,
        { label },
      );
    },
    createMetricSnapshot(sessionId: number) {
      return client.post<MetricSnapshot>(
        `/api/reading-sessions/${sessionId}/metrics/snapshot`,
        {},
      );
    },
    deleteHighlight(sessionId: number, highlightId: number) {
      return client.delete<ReadingSessionTimeline>(
        `/api/reading-sessions/${sessionId}/highlights/${highlightId}`,
      );
    },
    deleteInsight(sessionId: number, insightId: number) {
      return client.delete<ReadingSessionTimeline>(
        `/api/reading-sessions/${sessionId}/insights/${insightId}`,
      );
    },
    deleteMessage(messageId: number) {
      return client.delete<SessionMessage>(`/api/messages/${messageId}`);
    },
    deleteQuestion(questionId: number) {
      return client.delete<SessionQuestion>(`/api/questions/${questionId}`);
    },
    generateQuestions(windowId: number, focus: string) {
      return client.post<QuestionList>(`/api/session-windows/${windowId}/questions/generate`, {
        count: 3,
        focus,
      });
    },
    deleteTag(sessionId: number, tagId: number) {
      return client.delete<ReadingSessionTimeline>(
        `/api/reading-sessions/${sessionId}/tags/${tagId}`,
      );
    },
    latestTimeline() {
      return client.get<ReadingSessionTimeline | null>('/api/reading-sessions/latest');
    },
    readingSession(bookId: number) {
      return client.get<BookReadingSession | null>(
        `/api/books/${bookId}/reading-session`,
      );
    },
    ensureReadingSession(bookId: number) {
      return client.put<BookReadingSession>(
        `/api/books/${bookId}/reading-session`,
      );
    },
    timeline(sessionId: number) {
      return client.get<ReadingSessionTimeline>(
        `/api/reading-sessions/${sessionId}`,
      );
    },
    search(query: string) {
      return client.get<SessionSearchResponse>(
        `/api/reading-sessions/search?query=${encodeURIComponent(query)}`,
      );
    },
    streamAnswer(
      windowId: number,
      questionId: number,
      content: string,
      onEvent?: Parameters<ApiClient["stream"]>[2],
      signal?: AbortSignal,
    ) {
      return client.stream<SessionMessage>(
        `/api/session-windows/${windowId}/messages/stream`,
        { content, questionId },
        onEvent,
        signal,
      );
    },
    updateHighlight(sessionId: number, highlightId: number, input: HighlightInput) {
      return client.patch<ReadingSessionTimeline>(
        `/api/reading-sessions/${sessionId}/highlights/${highlightId}`,
        input,
      );
    },
    updateInsight(sessionId: number, insightId: number, input: InsightInput) {
      return client.patch<ReadingSessionTimeline>(
        `/api/reading-sessions/${sessionId}/insights/${insightId}`,
        input,
      );
    },
    updateMessage(messageId: number, content: string) {
      return client.patch<SessionMessage>(`/api/messages/${messageId}`, { content });
    },
    updateTitle(sessionId: number, title: string) {
      return client.patch<ReadingSessionTimeline>(
        `/api/reading-sessions/${sessionId}/title`,
        { title },
      );
    },
    updateWindowTitle(windowId: number, title: string) {
      return client.patch<SessionWindowMutation>(`/api/session-windows/${windowId}/title`, {
        title,
      });
    },
  };
}

export function useReadingSessionsApi() {
  const client = useApiClient();
  return useMemo(() => createReadingSessionsApi(client), [client]);
}
