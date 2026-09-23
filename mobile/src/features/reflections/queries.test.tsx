import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ApiClientProvider } from "@/shared/api/api-client-provider";
import type { ApiClient } from "@/shared/api/client";

import { reflectionKeys, useDiscussionTurn, useReflectionTimeline } from "./queries";
import type { DiscussionRun, ReflectionTimeline } from "./types";

function clientAndWrapper(queryClient: QueryClient, client: ApiClient) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <ApiClientProvider client={client}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiClientProvider>
    );
  }
  return QueryWrapper;
}

it("does not fetch the full timeline until its dependent surface is entered", async () => {
  const client = { get: jest.fn() } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const wrapper = clientAndWrapper(queryClient, client);
  const hook = await renderHook(() => useReflectionTimeline(9, false), { wrapper });

  expect(hook.result.current.fetchStatus).toBe("idle");
  expect(client.get).not.toHaveBeenCalled();
  hook.unmount();
  queryClient.clear();
});

it("cancels a stale timeline and merges a successful turn before background reconciliation", async () => {
  const response = {
    currentItem: { question: "Current", stage: "WARM_UP" },
    messages: [
      { content: "Reader", messageId: 3, role: "user", windowId: 5 },
      { content: "Guide", messageId: 4, role: "assistant", windowId: 5 },
    ],
    moderation: null,
    nextItem: { question: "Next", stage: "INTERPRETATION" },
    runId: 7,
    runStatus: "ACTIVE",
  };
  const client = { post: jest.fn().mockResolvedValue(response) } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false, staleTime: Infinity },
    },
  });
  const cancel = jest.spyOn(queryClient, "cancelQueries");
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  queryClient.setQueryData<DiscussionRun>(reflectionKeys.run(7), {
    currentItem: response.currentItem as never,
    guideId: 2,
    runId: 7,
    sessionId: 9,
    status: "ACTIVE",
    windowId: 5,
  });
  queryClient.setQueryData<ReflectionTimeline>(reflectionKeys.timeline(9), {
    bookId: 1,
    bookTitle: "Book",
    insights: [],
    messages: [{ content: "Old", messageId: 1, role: "assistant", windowId: 5 }],
    moderationEvents: [],
    questions: [],
    sessionId: 9,
    windows: [],
  });
  const wrapper = clientAndWrapper(queryClient, client);
  const hook = await renderHook(() => useDiscussionTurn(7, 9), { wrapper });

  await act(async () => {
    await hook.result.current.mutateAsync({ content: "Reader", navigation: "RESPOND" });
  });

  expect(cancel).toHaveBeenCalledWith({ queryKey: reflectionKeys.timeline(9) });
  expect(queryClient.getQueryData<ReflectionTimeline>(reflectionKeys.timeline(9))?.messages)
    .toEqual([
      { content: "Old", messageId: 1, role: "assistant", windowId: 5 },
      ...response.messages,
    ]);
  expect(queryClient.getQueryData<DiscussionRun>(reflectionKeys.run(7))?.currentItem)
    .toEqual(response.nextItem);
  await waitFor(() => expect(invalidate).toHaveBeenCalled());
  hook.unmount();
  queryClient.clear();
});
