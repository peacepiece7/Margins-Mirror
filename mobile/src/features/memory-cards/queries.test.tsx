import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ApiClientProvider } from "@/shared/api/api-client-provider";
import type { ApiClient } from "@/shared/api/client";

import { useCardMutations, useMemoryCardGroup } from "./queries";
import type { MemoryCardGroup, MemoryCardList } from "./types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

// BDD: MEM-003, MEM-005, FRONT-160 - Query owns the optimistic exact-group
// BDD: MEM-003
// value and restores the persisted snapshot when the command fails.
it("rolls an optimistic memorized change back when persistence fails", async () => {
  const client = {
    patch: jest.fn().mockRejectedValue(new Error("network")),
  } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const key = ["memory-cards", "groups", 2] as const;
  queryClient.setQueryData<MemoryCardGroup>(key, {
    groupId: 2,
    title: "Words",
    cardCount: 1,
    cards: [
      {
        cardId: 9,
        groupId: 2,
        frontText: "margin",
        backText: "여백",
        memorized: false,
        position: 0,
      },
    ],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useCardMutations(2), { wrapper });

  await act(async () => {
    await hook.result.current.memorize
      .mutateAsync({ cardId: 9, memorized: true })
      .catch(() => undefined);
  });
  await waitFor(() =>
    expect(
      queryClient.getQueryData<MemoryCardGroup>(key)?.cards?.[0].memorized,
    ).toBe(false),
  );
  hook.unmount();
  queryClient.clear();
});

it("does not request a group for a non-finite route identifier", async () => {
  const client = { get: jest.fn() } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );

  const hook = await renderHook(() => useMemoryCardGroup(Infinity), {
    wrapper,
  });

  expect(hook.result.current.fetchStatus).toBe("idle");
  expect(client.get).not.toHaveBeenCalled();
  hook.unmount();
  queryClient.clear();
});

// BDD: FRONT-159 - the cached checkbox/count changes before persistence
// completes, after any stale exact-group response has been cancelled.
it("waits for in-flight group queries to cancel before taking the optimistic snapshot", async () => {
  const cancellation = deferred<void>();
  const response = deferred<MemoryCardList>();
  const client = {
    patch: jest.fn().mockReturnValue(response.promise),
  } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const key = ["memory-cards", "groups", 2] as const;
  const group: MemoryCardGroup = {
    groupId: 2,
    title: "Words",
    cardCount: 1,
    cards: [
      {
        cardId: 9,
        groupId: 2,
        frontText: "margin",
        backText: "여백",
        memorized: false,
        position: 0,
      },
    ],
  };
  queryClient.setQueryData(key, group);
  jest.spyOn(queryClient, "cancelQueries").mockReturnValue(cancellation.promise);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useCardMutations(2), { wrapper });

  await act(async () => {
    hook.result.current.memorize.mutate({ cardId: 9, memorized: true });
    await Promise.resolve();
  });
  expect(client.patch).not.toHaveBeenCalled();
  expect(queryClient.getQueryData<MemoryCardGroup>(key)?.cards?.[0].memorized).toBe(false);

  await act(async () => {
    cancellation.resolve();
    await cancellation.promise;
  });
  await waitFor(() => expect(client.patch).toHaveBeenCalledTimes(1));
  expect(queryClient.getQueryData<MemoryCardGroup>(key)?.cards?.[0].memorized).toBe(true);

  await act(async () => {
    response.resolve({ groupId: 2, cards: [{ ...group.cards![0], memorized: true }] });
    await response.promise;
  });
  hook.unmount();
  queryClient.clear();
});

// BDD: MEM-006 - reconciliation remains an exact-group background refetch and
// does not replace the foreground optimistic intent with an older response.
it("preserves the latest optimistic intent when responses settle out of order", async () => {
  const first = deferred<MemoryCardList>();
  const second = deferred<MemoryCardList>();
  const client = {
    patch: jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
  } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const key = ["memory-cards", "groups", 2] as const;
  const group: MemoryCardGroup = {
    groupId: 2,
    title: "Words",
    cardCount: 1,
    cards: [
      {
        cardId: 9,
        groupId: 2,
        frontText: "margin",
        backText: "여백",
        memorized: false,
        position: 0,
      },
    ],
  };
  queryClient.setQueryData(key, group);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useCardMutations(2), { wrapper });

  await act(async () => {
    hook.result.current.memorize.mutate({ cardId: 9, memorized: true });
    hook.result.current.memorize.mutate({ cardId: 9, memorized: false });
  });
  expect(queryClient.getQueryData<MemoryCardGroup>(key)?.cards?.[0].memorized).toBe(false);

  await act(async () => {
    second.resolve({ groupId: 2, cards: group.cards ?? [] });
    await second.promise;
  });
  expect(queryClient.getQueryData<MemoryCardGroup>(key)?.cards?.[0].memorized).toBe(false);

  await act(async () => {
    first.resolve({
      groupId: 2,
      cards: [{ ...group.cards![0], memorized: true }],
    });
    await first.promise;
  });
  await waitFor(() =>
    expect(
      queryClient.getQueryData<MemoryCardGroup>(key)?.cards?.[0].memorized,
    ).toBe(false),
  );
  hook.unmount();
  queryClient.clear();
});
