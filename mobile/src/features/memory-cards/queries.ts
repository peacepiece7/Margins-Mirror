import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { useApiClient } from "@/shared/api/api-client-provider";

import { createMemoryCardsApi } from "./api";
import type {
  DuplicatePolicy,
  MemoryCardGroup,
  MemoryCardGroupInput,
  MemoryCardInput,
  MemoryCardList,
} from "./types";

const keys = {
  groups: ["memory-cards", "groups"] as const,
  groupList: (bookId?: number) => ["memory-cards", "groups", "list", bookId ?? "all"] as const,
  group: (id: number) => ["memory-cards", "groups", id] as const,
};

export function useMemoryCardGroups(enabled = true, bookId?: number) {
  const api = createMemoryCardsApi(useApiClient());
  return useQuery({ queryKey: keys.groupList(bookId), queryFn: () => api.groups(bookId), enabled });
}
export function useMemoryCardGroup(groupId: number, enabled = true) {
  const api = createMemoryCardsApi(useApiClient());
  return useQuery({
    queryKey: keys.group(groupId),
    queryFn: () => api.group(groupId),
    enabled: enabled && Number.isSafeInteger(groupId) && groupId > 0,
  });
}

export function useGroupMutations() {
  const api = createMemoryCardsApi(useApiClient());
  const cache = useQueryClient();
  return {
    create: useMutation({
      mutationFn: api.createGroup,
      onSuccess: () => cache.invalidateQueries({ queryKey: keys.groups }),
    }),
    update: useMutation({
      mutationFn: ({
        groupId,
        input,
      }: {
        groupId: number;
        input: MemoryCardGroupInput;
      }) => api.updateGroup(groupId, input),
      onSuccess: (group) => {
        cache.setQueryData(keys.group(group.groupId), group);
        void cache.invalidateQueries({ queryKey: keys.groups });
      },
    }),
    remove: useMutation({
      mutationFn: api.deleteGroup,
      onSuccess: () => cache.invalidateQueries({ queryKey: keys.groups }),
    }),
  };
}

function setCards(
  cache: ReturnType<typeof useQueryClient>,
  response: MemoryCardList,
) {
  cache.setQueryData<MemoryCardGroup>(keys.group(response.groupId), (group) =>
    group
      ? { ...group, cardCount: response.cards.length, cards: response.cards }
      : group,
  );
  void cache.invalidateQueries({ queryKey: keys.groups });
}

type MemorizeOperation = {
  cardId: number;
  memorized: boolean;
  operationId: number;
  response?: MemoryCardList;
  status: "pending" | "success" | "error";
};

type MemorizeBatch = {
  baseGroup: MemoryCardGroup | undefined;
  operations: MemorizeOperation[];
};

type MemorizeContext = {
  operationId: number;
};

function updateMemorized(
  group: MemoryCardGroup,
  cardId: number,
  memorized: boolean,
) {
  return {
    ...group,
    cards: group.cards?.map((card) =>
      card.cardId === cardId ? { ...card, memorized } : card,
    ),
  };
}

function reconcileMemorizeBatch(
  cache: ReturnType<typeof useQueryClient>,
  groupId: number,
  batch: MemorizeBatch,
  clearBatch: () => void,
) {
  const key = keys.group(groupId);
  if (batch.operations.some((operation) => operation.status === "pending")) {
    if (batch.baseGroup) {
      cache.setQueryData(
        key,
        batch.operations.reduce(
          (group, operation) =>
            operation.status === "error"
              ? group
              : updateMemorized(
                  group,
                  operation.cardId,
                  operation.memorized,
                ),
          batch.baseGroup,
        ),
      );
    }
    return;
  }

  const latestSuccess = [...batch.operations]
    .reverse()
    .find((operation) => operation.status === "success" && operation.response);
  if (latestSuccess?.response) {
    cache.setQueryData<MemoryCardGroup>(key, (group) =>
      group
        ? {
            ...group,
            cardCount: latestSuccess.response!.cards.length,
            cards: latestSuccess.response!.cards,
          }
        : group,
    );
  } else {
    cache.setQueryData(key, batch.baseGroup);
  }
  clearBatch();
  void cache.invalidateQueries({ queryKey: key, exact: true });
  void cache.invalidateQueries({ queryKey: keys.groups });
}

export function useCardMutations(groupId: number) {
  const api = createMemoryCardsApi(useApiClient());
  const cache = useQueryClient();
  const memorizeBatch = useRef<MemorizeBatch | undefined>(undefined);
  const nextOperationId = useRef(0);
  return {
    create: useMutation({
      mutationFn: (input: MemoryCardInput) => api.createCard(groupId, input),
      onSuccess: (response) => setCards(cache, response),
    }),
    bulk: useMutation({
      mutationFn: ({
        cards,
        duplicatePolicy,
      }: {
        cards: MemoryCardInput[];
        duplicatePolicy: DuplicatePolicy;
      }) => api.bulkCards(groupId, cards, duplicatePolicy),
      onSuccess: (response) => setCards(cache, response),
    }),
    update: useMutation({
      mutationFn: ({
        cardId,
        input,
      }: {
        cardId: number;
        input: MemoryCardInput;
      }) => api.updateCard(cardId, input),
      onSuccess: (response) => setCards(cache, response),
    }),
    memorize: useMutation({
      mutationFn: ({
        cardId,
        memorized,
      }: {
        cardId: number;
        memorized: boolean;
      }) => api.memorize(cardId, memorized),
      onMutate: async ({ cardId, memorized }): Promise<MemorizeContext> => {
        await cache.cancelQueries({ queryKey: keys.group(groupId), exact: true });
        const batch =
          memorizeBatch.current ??
          (memorizeBatch.current = {
            baseGroup: cache.getQueryData<MemoryCardGroup>(keys.group(groupId)),
            operations: [],
          });
        const operation = {
          cardId,
          memorized,
          operationId: ++nextOperationId.current,
          status: "pending" as const,
        };
        batch.operations.push(operation);
        reconcileMemorizeBatch(cache, groupId, batch, () => {
          memorizeBatch.current = undefined;
        });
        return { operationId: operation.operationId };
      },
      onError: (_error, _variables, context) => {
        const batch = memorizeBatch.current;
        const operation = batch?.operations.find(
          (candidate) => candidate.operationId === context?.operationId,
        );
        if (!batch || !operation) return;
        operation.status = "error";
        reconcileMemorizeBatch(cache, groupId, batch, () => {
          memorizeBatch.current = undefined;
        });
      },
      onSuccess: (response, _variables, context) => {
        const batch = memorizeBatch.current;
        const operation = batch?.operations.find(
          (candidate) => candidate.operationId === context.operationId,
        );
        if (!batch || !operation) return;
        operation.status = "success";
        operation.response = response;
        reconcileMemorizeBatch(cache, groupId, batch, () => {
          memorizeBatch.current = undefined;
        });
      },
    }),
    remove: useMutation({
      mutationFn: api.deleteCard,
      onSuccess: (response) => setCards(cache, response),
    }),
  };
}
