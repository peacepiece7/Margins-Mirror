import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ApiClientProvider } from "@/shared/api/api-client-provider";
import type { ApiClient } from "@/shared/api/client";
import { ApiRequestError } from "@/shared/api/error";

import {
  invalidateAuthoritativeTimeline,
  readingSessionKeys,
  sessionTitleForBook,
  useCreateReadingSession,
  useCreateHighlight,
  useCreateTag,
  useEnsureReadingSessionForBook,
  useStreamQuestionAnswer,
  useTimeline,
} from "./queries";
import type { ReadingSessionTimeline } from "./types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function timeline(
  title: string,
  tags: ReadingSessionTimeline["tags"] = [],
): ReadingSessionTimeline {
  return {
    bookId: 4,
    bookTitle: "Dune",
    highlights: [],
    insights: [],
    messages: [],
    questions: [],
    sessionId: 9,
    stats: {
      answeredQuestionCount: 0,
      messageCount: 0,
      personaCount: 0,
      personaResponseCount: 0,
      questionCount: 0,
      windowCount: 0,
    },
    tags,
    title,
    windows: [],
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false, staleTime: Infinity },
    },
  });
}

it("invalidates the timeline and matching latest projection without replacing either cache", async () => {
  const queryClient = createQueryClient();
  const cached = timeline("Cached");
  queryClient.setQueryData(readingSessionKeys.timeline(9), cached);
  queryClient.setQueryData(readingSessionKeys.latest, cached);
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");

  await invalidateAuthoritativeTimeline(queryClient, 9);

  expect(invalidate).toHaveBeenNthCalledWith(1, {
    exact: true,
    queryKey: readingSessionKeys.timeline(9),
  });
  expect(invalidate).toHaveBeenNthCalledWith(2, {
    exact: true,
    queryKey: readingSessionKeys.latest,
  });
  expect(queryClient.getQueryData(readingSessionKeys.timeline(9))).toBe(cached);
  expect(queryClient.getQueryData(readingSessionKeys.latest)).toBe(cached);
  queryClient.clear();
});

it("keeps the authoritative timeline when concurrent mutation responses settle in reverse order", async () => {
  const olderResponse = deferred<ReadingSessionTimeline>();
  const newerResponse = deferred<ReadingSessionTimeline>();
  const authoritative = timeline("Authoritative", [
    { label: "ecology", tagId: 4 },
  ]);
  const client = {
    get: jest.fn().mockResolvedValue(authoritative),
    post: jest.fn()
      .mockReturnValueOnce(olderResponse.promise)
      .mockReturnValueOnce(newerResponse.promise),
  } as unknown as ApiClient;
  const queryClient = createQueryClient();
  queryClient.setQueryData(readingSessionKeys.timeline(9), timeline("Initial"));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => ({
    createHighlight: useCreateHighlight(9),
    createTag: useCreateTag(9),
    currentTimeline: useTimeline(9),
  }), { wrapper });

  await act(async () => {
    hook.result.current.createHighlight.mutate({ quoteText: "First mutation" });
    hook.result.current.createTag.mutate("ecology");
  });
  await waitFor(() => expect(client.post).toHaveBeenCalledTimes(2));

  await act(async () => {
    newerResponse.resolve(authoritative);
    await newerResponse.promise;
  });
  expect(client.get).not.toHaveBeenCalled();

  await act(async () => {
    olderResponse.resolve(timeline("Older mutation response"));
    await olderResponse.promise;
  });
  await waitFor(() => expect(client.get).toHaveBeenCalledTimes(1));
  expect(
    queryClient.getQueryData(readingSessionKeys.timeline(9)),
  ).toStrictEqual(authoritative);

  hook.unmount();
  queryClient.clear();
});

// BDD: SESSION-011
it("writes a successful full timeline response without immediately refetching it", async () => {
  const authoritative = timeline("Updated", [{ label: "ecology", tagId: 4 }]);
  const client = {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue(authoritative),
  } as unknown as ApiClient;
  const queryClient = createQueryClient();
  queryClient.setQueryData(readingSessionKeys.timeline(9), timeline("Initial"));
  queryClient.setQueryData(readingSessionKeys.latest, timeline("Latest initial"));
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useCreateTag(9), { wrapper });

  await act(async () => hook.result.current.mutate("ecology"));
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

  expect(queryClient.getQueryData(readingSessionKeys.timeline(9))).toStrictEqual(authoritative);
  expect(queryClient.getQueryData(readingSessionKeys.latest)).toStrictEqual(authoritative);
  expect(invalidate).not.toHaveBeenCalled();
  expect(client.get).not.toHaveBeenCalled();
  hook.unmount();
  queryClient.clear();
});

it("does not let an older in-flight timeline read overwrite a successful mutation", async () => {
  const staleResponse = deferred<ReadingSessionTimeline>();
  const authoritative = timeline("Updated", [{ label: "ecology", tagId: 4 }]);
  const client = {
    get: jest.fn().mockReturnValue(staleResponse.promise),
    post: jest.fn().mockResolvedValue(authoritative),
  } as unknown as ApiClient;
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => ({
    createTag: useCreateTag(9),
    timeline: useTimeline(9),
  }), { wrapper });
  await waitFor(() => expect(client.get).toHaveBeenCalledTimes(1));

  await act(async () => hook.result.current.createTag.mutate("ecology"));
  await waitFor(() => expect(hook.result.current.createTag.isSuccess).toBe(true));
  staleResponse.resolve(timeline("Stale read"));
  await act(async () => staleResponse.promise);

  expect(queryClient.getQueryData(readingSessionKeys.timeline(9))).toStrictEqual(authoritative);
  hook.unmount();
  queryClient.clear();
});

it("invalidates the authoritative timeline after a standalone mutation failure", async () => {
  const client = {
    post: jest.fn().mockRejectedValue(new Error("write unavailable")),
  } as unknown as ApiClient;
  const queryClient = createQueryClient();
  queryClient.setQueryData(readingSessionKeys.timeline(9), timeline("Initial"));
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useCreateTag(9), { wrapper });

  await act(async () => hook.result.current.mutate("ecology"));
  await waitFor(() => expect(hook.result.current.isError).toBe(true));

  expect(invalidate).toHaveBeenCalledWith({
    exact: true,
    queryKey: readingSessionKeys.timeline(9),
  });
  hook.unmount();
  queryClient.clear();
});

// BDD: FRONT-047, FRONT-048, FRONT-049, FRONT-050
// BDD: FRONT-048
it("keeps a created session recoverable when default-window setup fails", async () => {
  const authoritative = timeline("Long title reflection");
  const client = {
    get: jest.fn().mockResolvedValue(authoritative),
    post: jest.fn()
      .mockResolvedValueOnce({ bookId: 4, sessionId: 9, title: "Long title reflection" })
      .mockRejectedValueOnce(new Error("window unavailable")),
  } as unknown as ApiClient;
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useCreateReadingSession(4), { wrapper });

  await act(async () => hook.result.current.mutate("Dune"));
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

  expect(client.post).toHaveBeenNthCalledWith(1, "/api/reading-sessions", {
    bookId: 4,
    title: "Dune reflection",
  });
  expect(client.post).toHaveBeenNthCalledWith(2, "/api/session-windows", {
    sessionId: 9,
    title: "Reflection Window",
    windowType: "question",
  });
  expect(hook.result.current.data?.warning).toBe("window");
  expect(queryClient.getQueryData(readingSessionKeys.timeline(9))).toStrictEqual(authoritative);
  queryClient.clear();
});

it("preserves the reflection suffix inside the 255-character create limit", () => {
  const title = sessionTitleForBook("a".repeat(300));
  expect(title).toHaveLength(255);
  expect(title.endsWith(" reflection")).toBe(true);
});

// BDD: SESSION-006
it("ensures only the session locator and writes it to the book cache", async () => {
  const locator = { sessionId: 9, title: "Book 4 reflection" };
  const client = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn().mockResolvedValue(locator),
  } as unknown as ApiClient;
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useEnsureReadingSessionForBook(), { wrapper });

  await act(async () => hook.result.current.mutate(4));
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

  expect(client.put).toHaveBeenCalledWith("/api/books/4/reading-session");
  expect(client.post).not.toHaveBeenCalled();
  expect(client.get).not.toHaveBeenCalled();
  expect(queryClient.getQueryData(readingSessionKeys.book(4))).toStrictEqual(locator);
  queryClient.clear();
});

it("threads cancellation into the answer stream and reconciles the authoritative timeline after interruption", async () => {
  const onDelta = jest.fn();
  const controller = new AbortController();
  const client = {
    stream: jest.fn((_path, _body, onEvent) => {
      onEvent({ data: { delta: "Partial" }, event: "message.delta" });
      return Promise.reject(new Error("aborted"));
    }),
  } as unknown as ApiClient;
  const queryClient = createQueryClient();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useStreamQuestionAnswer(9), { wrapper });

  await act(async () => hook.result.current.mutate({
    content: "Keep my draft",
    onDelta,
    questionId: 8,
    signal: controller.signal,
    windowId: 7,
  }));
  await waitFor(() => expect(hook.result.current.isError).toBe(true));

  expect(onDelta).toHaveBeenCalledWith("Partial");
  expect(client.stream).toHaveBeenCalledWith(
    "/api/session-windows/7/messages/stream",
    { content: "Keep my draft", questionId: 8 },
    expect.any(Function),
    controller.signal,
  );
  expect(invalidate).toHaveBeenCalledWith({
    exact: true,
    queryKey: readingSessionKeys.timeline(9),
  });
  hook.unmount();
  queryClient.clear();
});

// BDD: FRONT-047, FRONT-049
it("recovers the authoritative session after a concurrent create conflict", async () => {
  const authoritative = timeline("Concurrent reflection");
  const client = {
    get: jest.fn()
      .mockResolvedValueOnce({ sessionId: 9, title: "Concurrent reflection" })
      .mockResolvedValueOnce(authoritative),
    post: jest.fn().mockRejectedValue(new ApiRequestError({ code: "COMMON_CONFLICT", status: 409 })),
  } as unknown as ApiClient;
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useCreateReadingSession(4), { wrapper });

  await act(async () => hook.result.current.mutate("Dune"));
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

  expect(client.get).toHaveBeenNthCalledWith(1, "/api/books/4/reading-session");
  expect(client.get).toHaveBeenNthCalledWith(2, "/api/reading-sessions/9");
  expect(hook.result.current.data?.created.sessionId).toBe(9);
  expect(queryClient.getQueryData(readingSessionKeys.timeline(9))).toStrictEqual(authoritative);
  queryClient.clear();
});
