import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import type { MemoryCard, MemoryCardGroup, MemoryCardListResponse } from '@/types/api/memory-card';

import { memoryCardsApi } from './api';
import {
  memoryCardKeys,
  useMemoryCardGroupQuery,
  useMemoryCardMemorizedMutation,
  useMemoryCardMemorizedPendingCardIds,
} from './queries';

vi.mock('./api', () => ({
  memoryCardsApi: {
    group: vi.fn(),
    updateMemorized: vi.fn(),
  },
}));

const card: MemoryCard = {
  cardId: 11,
  groupId: 7,
  frontText: 'wand',
  backText: '지팡이',
  memorized: false,
  position: 1,
};

const group: MemoryCardGroup = {
  groupId: 7,
  title: 'Fantasy words',
  cardCount: 1,
  cards: [card],
};

const secondCard: MemoryCard = {
  cardId: 12,
  groupId: 7,
  frontText: 'cloak',
  backText: '망토',
  memorized: false,
  position: 2,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(cards: MemoryCard[]): MemoryCardListResponse {
  return { groupId: 7, cards };
}

describe('Memory Card memorized query mutation', () => {
  it('preserves the latest optimistic intent when concurrent responses settle out of order', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const otherGroup = { ...group, groupId: 8, title: 'Other words' };
    client.setQueryData(memoryCardKeys.group(7), group);
    client.setQueryData(memoryCardKeys.group(8), otherGroup);
    const first = deferred<MemoryCardListResponse>();
    const second = deferred<MemoryCardListResponse>();
    vi.mocked(memoryCardsApi.updateMemorized).mockImplementation((_cardId, memorized) =>
      memorized ? first.promise : second.promise,
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useMemoryCardMemorizedMutation(), { wrapper });

    let firstMutation!: Promise<MemoryCardListResponse>;
    let secondMutation!: Promise<MemoryCardListResponse>;
    act(() => {
      firstMutation = result.current.mutateAsync({ groupId: 7, cardId: 11, memorized: true });
      secondMutation = result.current.mutateAsync({ groupId: 7, cardId: 11, memorized: false });
    });

    await waitFor(() => expect(memoryCardsApi.updateMemorized).toHaveBeenCalledTimes(2));
    expect(
      client.getQueryData<MemoryCardGroup>(memoryCardKeys.group(7))?.cards?.[0].memorized,
    ).toBe(false);
    expect(client.getQueryData(memoryCardKeys.group(8))).toEqual(otherGroup);

    await act(async () => {
      first.reject(new Error('first request failed'));
      await expect(firstMutation).rejects.toThrow('first request failed');
    });
    expect(
      client.getQueryData<MemoryCardGroup>(memoryCardKeys.group(7))?.cards?.[0].memorized,
    ).toBe(false);

    await act(async () => {
      second.resolve(response([{ ...card, memorized: false }]));
      await secondMutation;
    });
    expect(
      client.getQueryData<MemoryCardGroup>(memoryCardKeys.group(7))?.cards?.[0].memorized,
    ).toBe(false);
    expect(client.getQueryState(memoryCardKeys.group(7))?.isInvalidated).toBe(true);
    expect(client.getQueryState(memoryCardKeys.group(8))?.isInvalidated).toBe(false);
  });

  it('tracks every pending card mutation independently', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const twoCardGroup = { ...group, cardCount: 2, cards: [card, secondCard] };
    client.setQueryData(memoryCardKeys.group(7), twoCardGroup);
    const first = deferred<MemoryCardListResponse>();
    const second = deferred<MemoryCardListResponse>();
    vi.mocked(memoryCardsApi.updateMemorized).mockImplementation((cardId) =>
      cardId === 11 ? first.promise : second.promise,
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        mutation: useMemoryCardMemorizedMutation(),
        pendingCardIds: useMemoryCardMemorizedPendingCardIds(),
      }),
      { wrapper },
    );

    let firstMutation!: Promise<MemoryCardListResponse>;
    let secondMutation!: Promise<MemoryCardListResponse>;
    act(() => {
      firstMutation = result.current.mutation.mutateAsync({
        groupId: 7,
        cardId: 11,
        memorized: true,
      });
      secondMutation = result.current.mutation.mutateAsync({
        groupId: 7,
        cardId: 12,
        memorized: true,
      });
    });

    await waitFor(() =>
      expect(result.current.pendingCardIds).toEqual(expect.arrayContaining([11, 12])),
    );
    first.resolve(response([{ ...card, memorized: true }, secondCard]));
    second.resolve(
      response([
        { ...card, memorized: true },
        { ...secondCard, memorized: true },
      ]),
    );
    await act(async () => {
      await Promise.all([firstMutation, secondMutation]);
    });
    await waitFor(() => expect(result.current.pendingCardIds).toEqual([]));
  });

  it('refetches the exact group so backend commit order becomes authoritative', async () => {
    const initialGroup = { ...group, cardCount: 2, cards: [card, secondCard] };
    const authoritativeGroup = {
      ...initialGroup,
      cards: [
        { ...card, memorized: true },
        { ...secondCard, memorized: true },
      ],
    };
    const client = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false, staleTime: Infinity },
      },
    });
    client.setQueryData(memoryCardKeys.group(7), initialGroup);
    const first = deferred<MemoryCardListResponse>();
    const second = deferred<MemoryCardListResponse>();
    vi.mocked(memoryCardsApi.group).mockResolvedValue(authoritativeGroup);
    vi.mocked(memoryCardsApi.updateMemorized).mockImplementation((cardId) =>
      cardId === 11 ? first.promise : second.promise,
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        mutation: useMemoryCardMemorizedMutation(),
        group: useMemoryCardGroupQuery(7),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.group.data).toEqual(initialGroup));
    let firstMutation!: Promise<MemoryCardListResponse>;
    let secondMutation!: Promise<MemoryCardListResponse>;
    act(() => {
      firstMutation = result.current.mutation.mutateAsync({
        groupId: 7,
        cardId: 11,
        memorized: true,
      });
      secondMutation = result.current.mutation.mutateAsync({
        groupId: 7,
        cardId: 12,
        memorized: true,
      });
    });
    await waitFor(() =>
      expect(
        client
          .getQueryData<MemoryCardGroup>(memoryCardKeys.group(7))
          ?.cards?.map((currentCard) => currentCard.memorized),
      ).toEqual([true, true]),
    );

    second.resolve(response([card, { ...secondCard, memorized: true }]));
    await secondMutation;
    first.resolve(response([{ ...card, memorized: true }, secondCard]));
    await firstMutation;

    await waitFor(() =>
      expect(result.current.group.data?.cards?.map((currentCard) => currentCard.memorized)).toEqual(
        [true, true],
      ),
    );
    expect(memoryCardsApi.group).toHaveBeenCalledWith(7);
  });
});
