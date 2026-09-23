import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiRequestError } from "@/shared/api/error";

import { useReadingSessionsApi } from "./api";
import type { HighlightInput, InsightInput, ReadingSessionTimeline } from "./types";

export const SESSION_TITLE_MAX_LENGTH = 200;
export const WINDOW_TITLE_MAX_LENGTH = 200;
export const HIGHLIGHT_QUOTE_MAX_LENGTH = 5_000;
export const HIGHLIGHT_NOTE_MAX_LENGTH = 2_000;
export const HIGHLIGHT_LOCATION_MAX_LENGTH = 120;
export const TAG_MAX_LENGTH = 80;

export function sessionTitleForBook(bookTitle: string) {
  const suffix = " reflection";
  return `${bookTitle.slice(0, 255 - suffix.length)}${suffix}`;
}

export const readingSessionKeys = {
  book: (bookId: number) => ["reading-sessions", "book", bookId] as const,
  latest: ["reading-sessions", "latest"] as const,
  search: (query: string) => ["reading-sessions", "search", query] as const,
  timeline: (sessionId: number) =>
    ["reading-sessions", "timeline", sessionId] as const,
};

export function useLatestTimeline() {
  const api = useReadingSessionsApi();
  return useQuery({ queryFn: () => api.latestTimeline(), queryKey: readingSessionKeys.latest });
}

export function useSessionSearch(query: string) {
  const api = useReadingSessionsApi();
  return useQuery({
    enabled: Boolean(query.trim()),
    queryFn: () => api.search(query),
    queryKey: readingSessionKeys.search(query),
  });
}

export async function invalidateAuthoritativeTimeline(
  queryClient: QueryClient,
  sessionId: number,
) {
  const invalidations = [
    queryClient.invalidateQueries({
      exact: true,
      queryKey: readingSessionKeys.timeline(sessionId),
    }),
  ];
  const latest = queryClient.getQueryData<ReadingSessionTimeline | null>(
    readingSessionKeys.latest,
  );
  if (latest?.sessionId === sessionId) {
    invalidations.push(
      queryClient.invalidateQueries({
        exact: true,
        queryKey: readingSessionKeys.latest,
      }),
    );
  }
  await Promise.all(invalidations);
}

function writeAuthoritativeTimeline(
  queryClient: QueryClient,
  timeline: ReadingSessionTimeline,
) {
  queryClient.setQueryData(readingSessionKeys.timeline(timeline.sessionId), timeline);
  const latest = queryClient.getQueryData<ReadingSessionTimeline | null>(readingSessionKeys.latest);
  if (latest?.sessionId === timeline.sessionId) {
    queryClient.setQueryData(readingSessionKeys.latest, timeline);
  }
}

async function cancelAuthoritativeTimelineReads(
  queryClient: QueryClient,
  sessionId: number,
) {
  const cancellations = [
    queryClient.cancelQueries({
      exact: true,
      queryKey: readingSessionKeys.timeline(sessionId),
    }),
  ];
  const latest = queryClient.getQueryData<ReadingSessionTimeline | null>(
    readingSessionKeys.latest,
  );
  if (latest?.sessionId === sessionId) {
    cancellations.push(
      queryClient.cancelQueries({
        exact: true,
        queryKey: readingSessionKeys.latest,
      }),
    );
  }
  await Promise.all(cancellations);
}

type TimelineMutationState = { overlapped: boolean; pending: number };
const timelineMutationStates = new WeakMap<
  QueryClient,
  Map<number, TimelineMutationState>
>();

function beginTimelineMutation(queryClient: QueryClient, sessionId: number) {
  let states = timelineMutationStates.get(queryClient);
  if (!states) {
    states = new Map();
    timelineMutationStates.set(queryClient, states);
  }
  let state = states.get(sessionId);
  if (!state) {
    state = { overlapped: false, pending: 0 };
    states.set(sessionId, state);
  }
  state.pending += 1;
  state.overlapped ||= state.pending > 1;
  return state;
}

function finishTimelineMutation(
  queryClient: QueryClient,
  sessionId: number,
  state?: TimelineMutationState,
) {
  if (!state) return undefined;
  state.pending -= 1;
  if (state.pending > 0) return undefined;
  timelineMutationStates.get(queryClient)?.delete(sessionId);
  return state;
}

export function useBookReadingSession(bookId: number) {
  const api = useReadingSessionsApi();
  return useQuery({
    enabled: bookId > 0,
    queryFn: () => api.readingSession(bookId),
    queryKey: readingSessionKeys.book(bookId),
  });
}

export function useTimeline(sessionId?: number) {
  const api = useReadingSessionsApi();
  return useQuery({
    enabled: Boolean(sessionId),
    queryFn: () => api.timeline(sessionId!),
    queryKey: readingSessionKeys.timeline(sessionId ?? 0),
    retry: false,
  });
}

export function useCreateReadingSession(bookId: number) {
  const api = useReadingSessionsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookTitle: string) => createReadingSession(api, bookId, bookTitle),
    onSuccess: async ({ created, timeline }) => {
      if (timeline) {
        queryClient.setQueryData(readingSessionKeys.timeline(created.sessionId), timeline);
      }
      await Promise.all([
        queryClient.invalidateQueries({ exact: true, queryKey: readingSessionKeys.book(bookId) }),
        queryClient.invalidateQueries({ exact: true, queryKey: readingSessionKeys.latest }),
      ]);
    },
  });
}

export function useEnsureReadingSessionForBook() {
  const api = useReadingSessionsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookId: number) => api.ensureReadingSession(bookId),
    onSuccess: async (session, bookId) => {
      queryClient.setQueryData(readingSessionKeys.book(bookId), session);
      await queryClient.invalidateQueries({
        queryKey: ["reflections", "threads"],
        refetchType: "none",
      });
    },
  });
}

async function createReadingSession(
  api: ReturnType<typeof useReadingSessionsApi>,
  bookId: number,
  bookTitle: string,
) {
  let created;
  try {
    created = await api.createSession(bookId, sessionTitleForBook(bookTitle));
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 409) throw error;
    const existing = await api.readingSession(bookId);
    if (!existing) throw error;
    const timeline = await api.timeline(existing.sessionId);
    return {
      created: { bookId, sessionId: existing.sessionId, title: existing.title },
      timeline,
      warning: undefined,
    };
  }
  let warning: "window" | "reload" | undefined;
  try {
    await api.createWindow(created.sessionId, "Reflection Window");
  } catch {
    warning = "window";
  }
  let timeline: ReadingSessionTimeline | null = null;
  try {
    timeline = await api.timeline(created.sessionId);
  } catch {
    warning ??= "reload";
  }
  return { created, timeline, warning };
}

function useTimelineMutation<T>(
  sessionId: number,
  mutationFn: (input: T) => Promise<ReadingSessionTimeline>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async () => {
      const state = beginTimelineMutation(queryClient, sessionId);
      await cancelAuthoritativeTimelineReads(queryClient, sessionId);
      return state;
    },
    onSuccess: (timeline, _input, state) => {
      if (!state?.overlapped) {
        writeAuthoritativeTimeline(queryClient, timeline);
      }
    },
    onSettled: (_timeline, _error, _input, state) => {
      const finished = finishTimelineMutation(queryClient, sessionId, state);
      if (finished && (_error || finished.overlapped)) {
        return invalidateAuthoritativeTimeline(queryClient, sessionId);
      }
    },
  });
}

export function useCreateHighlight(sessionId: number) {
  const api = useReadingSessionsApi();
  return useTimelineMutation(sessionId, (input: HighlightInput) =>
    api.createHighlight(sessionId, input),
  );
}

export function useCreateTag(sessionId: number) {
  const api = useReadingSessionsApi();
  return useTimelineMutation(sessionId, (label: string) =>
    api.createTag(sessionId, label),
  );
}

export function useCreateInsight(sessionId: number) {
  const api = useReadingSessionsApi();
  return useTimelineMutation(
    sessionId,
    (input: InsightInput) =>
      api.createInsight(sessionId, input),
  );
}

export function useUpdateHighlight(sessionId: number) {
  const api = useReadingSessionsApi();
  return useTimelineMutation(
    sessionId,
    ({ highlightId, input }: { highlightId: number; input: HighlightInput }) =>
      api.updateHighlight(sessionId, highlightId, input),
  );
}

export function useDeleteHighlight(sessionId: number) {
  const api = useReadingSessionsApi();
  return useTimelineMutation(sessionId, (highlightId: number) =>
    api.deleteHighlight(sessionId, highlightId),
  );
}

export function useDeleteTag(sessionId: number) {
  const api = useReadingSessionsApi();
  return useTimelineMutation(sessionId, (tagId: number) =>
    api.deleteTag(sessionId, tagId),
  );
}

export function useUpdateInsight(sessionId: number) {
  const api = useReadingSessionsApi();
  return useTimelineMutation(
    sessionId,
    ({ insightId, input }: { insightId: number; input: InsightInput }) =>
      api.updateInsight(sessionId, insightId, input),
  );
}

export function useDeleteInsight(sessionId: number) {
  const api = useReadingSessionsApi();
  return useTimelineMutation(sessionId, (insightId: number) =>
    api.deleteInsight(sessionId, insightId),
  );
}

export function useMetricSnapshot(sessionId: number) {
  const api = useReadingSessionsApi();
  return useMutation({ mutationFn: () => api.createMetricSnapshot(sessionId) });
}

export function useUpdateSessionTitle(sessionId: number) {
  const api = useReadingSessionsApi();
  return useTimelineMutation(sessionId, (title: string) => api.updateTitle(sessionId, title));
}

function useInvalidatingMutation<T, R>(sessionId: number, mutationFn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSettled: () => invalidateAuthoritativeTimeline(queryClient, sessionId) });
}

export function useCreateSessionWindow(sessionId: number) {
  const api = useReadingSessionsApi();
  return useInvalidatingMutation(sessionId, (title: string) => api.createWindow(sessionId, title));
}

export function useUpdateWindowTitle(sessionId: number) {
  const api = useReadingSessionsApi();
  return useInvalidatingMutation(sessionId, ({ title, windowId }: { title: string; windowId: number }) => api.updateWindowTitle(windowId, title));
}

export function useArchiveWindow(sessionId: number) {
  const api = useReadingSessionsApi();
  return useInvalidatingMutation(sessionId, (windowId: number) => api.archiveWindow(windowId));
}

export function useCreateQuestion(sessionId: number) {
  const api = useReadingSessionsApi();
  return useInvalidatingMutation(sessionId, ({ questionText, windowId }: { questionText: string; windowId: number }) => api.createQuestion(windowId, questionText));
}

export function useDeleteQuestion(sessionId: number) {
  const api = useReadingSessionsApi();
  return useInvalidatingMutation(sessionId, (questionId: number) => api.deleteQuestion(questionId));
}

export function useGenerateWindowQuestions(sessionId: number) {
  const api = useReadingSessionsApi();
  return useInvalidatingMutation(sessionId, ({ focus, windowId }: { focus: string; windowId: number }) => api.generateQuestions(windowId, focus));
}

export function useUpdateMessage(sessionId: number) {
  const api = useReadingSessionsApi();
  return useInvalidatingMutation(sessionId, ({ content, messageId }: { content: string; messageId: number }) => api.updateMessage(messageId, content));
}

export function useDeleteMessage(sessionId: number) {
  const api = useReadingSessionsApi();
  return useInvalidatingMutation(sessionId, (messageId: number) => api.deleteMessage(messageId));
}

export function useStreamQuestionAnswer(sessionId: number) {
  const api = useReadingSessionsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, onDelta, questionId, signal, windowId }: { content: string; onDelta(delta: string): void; questionId: number; signal?: AbortSignal; windowId: number }) =>
      api.streamAnswer(windowId, questionId, content, (event) => {
        if (event.event === "message.delta") {
          const payload = event.data as { delta?: string };
          if (payload.delta) onDelta(payload.delta);
        }
      }, signal),
    onSettled: () => invalidateAuthoritativeTimeline(queryClient, sessionId),
  });
}

export function useArchiveSession(bookId: number, sessionId: number) {
  const api = useReadingSessionsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.archiveSession(sessionId),
    onSuccess: async () => {
      queryClient.removeQueries({ exact: true, queryKey: readingSessionKeys.timeline(sessionId) });
      await Promise.all([
        queryClient.invalidateQueries({ exact: true, queryKey: readingSessionKeys.book(bookId) }),
        queryClient.invalidateQueries({ exact: true, queryKey: readingSessionKeys.latest }),
      ]);
    },
  });
}
