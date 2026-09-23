import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useDebatesApi } from "./api";
import type { PersonaInput, PersonaList } from "./types";

export const debateKeys = {
  bookSession: (bookId: number) =>
    ["reading-sessions", "book", bookId] as const,
  personas: ["debates", "personas"] as const,
  recommendations: (bookId: number) =>
    ["debates", "recommendations", bookId] as const,
  timeline: (sessionId: number) =>
    ["reading-sessions", "timeline", sessionId] as const,
};

async function invalidateDebateContext(
  queryClient: QueryClient,
  sessionId: number,
) {
  await queryClient.invalidateQueries({
    queryKey: debateKeys.timeline(sessionId),
  });
}

export async function reconcileDebateTimeline(
  queryClient: QueryClient,
  sessionId: number,
) {
  await queryClient.invalidateQueries({
    queryKey: debateKeys.timeline(sessionId),
  });
}

export function usePersonaCatalog() {
  const api = useDebatesApi();
  return useQuery({
    queryFn: api.personas,
    queryKey: debateKeys.personas,
  });
}

export function usePersonaRecommendations(bookId: number) {
  const api = useDebatesApi();
  return useQuery({
    enabled: Number.isSafeInteger(bookId) && bookId > 0,
    queryFn: () => api.recommendations(bookId),
    queryKey: debateKeys.recommendations(bookId),
  });
}
export function useBookDebateSession(bookId: number) {
  const api = useDebatesApi();
  return useQuery({
    enabled: Number.isSafeInteger(bookId) && bookId > 0,
    queryFn: () => api.readingSession(bookId),
    queryKey: debateKeys.bookSession(bookId),
  });
}
export function useDebateTimeline(sessionId: number) {
  const api = useDebatesApi();
  return useQuery({
    enabled: sessionId > 0,
    queryFn: () => api.timeline(sessionId),
    queryKey: debateKeys.timeline(sessionId),
  });
}
export function useCreateDebateWindow() {
  const api = useDebatesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      personaIds: number[];
      sessionId: number;
      title: string;
    }) => api.createWindow(input.sessionId, input.title, input.personaIds),
    onSuccess: (window) => reconcileDebateTimeline(qc, window.sessionId),
  });
}
export function useCreatePersona() {
  const api = useDebatesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PersonaInput) => api.createPersona(input),
    onSuccess: (personas: PersonaList) => {
      qc.setQueryData(debateKeys.personas, personas);
    },
  });
}
export function useEnsureQuestionDebateWindow() {
  const api = useDebatesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: number) => api.ensureQuestionDebateWindow(questionId),
    onSuccess: (window) => invalidateDebateContext(qc, window.sessionId),
  });
}
export function useRenameDebateWindow(sessionId: number) {
  const api = useDebatesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ title, windowId }: { title: string; windowId: number }) =>
      api.updateWindowTitle(windowId, title),
    onSuccess: () => invalidateDebateContext(qc, sessionId),
  });
}
export function useArchiveDebateWindow(sessionId: number) {
  const api = useDebatesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (windowId: number) => api.archiveWindow(windowId),
    onSuccess: () => invalidateDebateContext(qc, sessionId),
  });
}
export function useEditDebateMessage(sessionId: number) {
  const api = useDebatesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, messageId }: { content: string; messageId: number }) =>
      api.updateMessage(messageId, content),
    onSuccess: () => invalidateDebateContext(qc, sessionId),
  });
}
export function useDeleteDebateMessage(sessionId: number) {
  const api = useDebatesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) => api.deleteMessage(messageId),
    onSuccess: () => invalidateDebateContext(qc, sessionId),
  });
}
export function useModerationFeedback(sessionId: number) {
  const api = useDebatesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      feedback,
    }: {
      eventId: number;
      feedback: "RELATED" | "NOT_RELATED";
    }) => api.moderationFeedback(eventId, feedback),
    onSuccess: () => invalidateDebateContext(qc, sessionId),
  });
}
export function usePersonaDebate(sessionId: number, windowId: number) {
  const api = useDebatesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; personaIds: number[] }) =>
      input.personaIds.length === 1
        ? api.debate(windowId, input.content, input.personaIds[0])
        : api.debateAll(windowId, input.content, input.personaIds),
    onSettled: () => reconcileDebateTimeline(qc, sessionId),
  });
}
export function useStreamMessage(
  sessionId: number,
  windowId: number,
  onDelta: (delta: string) => void,
) {
  const api = useDebatesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, signal }: { content: string; signal: AbortSignal }) =>
      api.streamMessage(windowId, content, (event) => {
        if (event.event === "message.delta")
          onDelta((event.data as { delta?: string }).delta ?? "");
      }, signal),
    onSettled: () => reconcileDebateTimeline(qc, sessionId),
  });
}
