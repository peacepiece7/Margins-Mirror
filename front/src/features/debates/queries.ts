import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { personaKeys, sessionKeys } from '@/lib/query-keys';

import { debatesApi } from './api';

export const personaQueryOptions = {
  list: () => queryOptions({ queryKey: personaKeys.list(), queryFn: debatesApi.personas }),
  recommendations: (bookId: number) =>
    queryOptions({
      queryKey: personaKeys.recommendation(bookId),
      queryFn: () => debatesApi.recommendations(bookId),
      enabled: Number.isSafeInteger(bookId) && bookId > 0,
    }),
};

export const debateSessionQueryOptions = {
  sessions: () => queryOptions({ queryKey: sessionKeys.list(), queryFn: debatesApi.sessions }),
  timeline: (sessionId: number) =>
    queryOptions({
      queryKey: sessionKeys.timeline(sessionId),
      queryFn: () => debatesApi.timeline(sessionId),
      enabled: sessionId > 0,
    }),
};

export function usePersonasQuery() {
  return useQuery(personaQueryOptions.list());
}

export function usePersonaRecommendationsQuery(bookId: number) {
  return useQuery(personaQueryOptions.recommendations(bookId));
}

export function useDebateTimelineForBook(bookId: number) {
  const sessions = useQuery(debateSessionQueryOptions.sessions());
  const sessionId = sessions.data?.sessions.find((session) => session.bookId === bookId)?.sessionId;
  const timeline = useQuery({
    ...debateSessionQueryOptions.timeline(sessionId ?? 0),
    enabled: Boolean(sessionId),
  });
  return { sessionId, sessions, timeline };
}

export function useCreateDebateRoomMutation(bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId: existingSessionId,
      topic,
      personaIds,
    }: {
      sessionId?: number;
      topic: string;
      personaIds: number[];
    }) => {
      const sessionId =
        existingSessionId ??
        (await debatesApi.sessions()).sessions.find((session) => session.bookId === bookId)
          ?.sessionId;
      if (!sessionId) {
        throw new Error('Reading session is not available yet');
      }
      const window = await debatesApi.createWindow(
        sessionId,
        'debate',
        `Debate: ${topic}`,
        personaIds,
      );
      return { sessionId, windowId: window.windowId, personaIds: window.personaIds };
    },
    onSuccess: async ({ sessionId }) => {
      await queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) });
    },
  });
}

export function useDebateMutation(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      windowId,
      personaId,
      content,
    }: {
      windowId: number;
      personaId: number;
      content: string;
    }) => debatesApi.debate(windowId, personaId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) }),
  });
}

export function useDebateAllMutation(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      windowId,
      content,
      personaIds,
    }: {
      windowId: number;
      content: string;
      personaIds: number[];
    }) => debatesApi.debateAll(windowId, content, personaIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) }),
  });
}

export function useModerationFeedbackMutation(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, feedback }: { eventId: number; feedback: 'RELATED' | 'NOT_RELATED' }) =>
      debatesApi.moderationFeedback(eventId, feedback),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) }),
  });
}
