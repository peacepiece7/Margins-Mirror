import {
  queryOptions,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRef } from 'react';

import type {
  BulkMemoryCardRequest,
  MemoryCardGroup,
  MemoryCardGroupInput,
  MemoryCardGroupListResponse,
  MemoryCardInput,
  MemoryCardListResponse,
} from '@/types/api/memory-card';
import { protectedQueryRoots } from '@/lib/query-keys';

import { memoryCardsApi } from './api';

export const memoryCardKeys = {
  all: protectedQueryRoots.memoryCards,
  groups: () => [...memoryCardKeys.all, 'groups'] as const,
  group: (groupId: number) => [...memoryCardKeys.groups(), groupId] as const,
  memorized: () => [...memoryCardKeys.all, 'memorized'] as const,
};

export interface MemoryCardMemorizedVariables {
  groupId: number;
  cardId: number;
  memorized: boolean;
}

type MemorizedOperation = MemoryCardMemorizedVariables & {
  operationId: number;
  status: 'pending' | 'success' | 'error';
  response?: MemoryCardListResponse;
};

interface MemorizedBatch {
  baseGroup: MemoryCardGroup | undefined;
  operations: MemorizedOperation[];
}

interface MemorizedMutationContext {
  batchKey: string;
  queryKey: ReturnType<typeof memoryCardKeys.group>;
  operationId: number;
}

export const memoryCardQueryOptions = {
  groups: () =>
    queryOptions({
      queryKey: memoryCardKeys.groups(),
      queryFn: () => memoryCardsApi.groups(),
    }),
  group: (groupId: number) =>
    queryOptions({
      queryKey: memoryCardKeys.group(groupId),
      queryFn: () => memoryCardsApi.group(groupId),
      enabled: Number.isSafeInteger(groupId) && groupId > 0,
    }),
};

export function useMemoryCardGroupsQuery() {
  return useQuery(memoryCardQueryOptions.groups());
}

export function useMemoryCardGroupQuery(groupId?: number) {
  return useQuery(memoryCardQueryOptions.group(groupId ?? 0));
}

function setGroupCards(
  queryClient: ReturnType<typeof useQueryClient>,
  response: MemoryCardListResponse,
) {
  const queryKey = memoryCardKeys.group(response.groupId);
  queryClient.setQueryData<MemoryCardGroup | undefined>(queryKey, (current) =>
    current ? { ...current, cardCount: response.cards.length, cards: response.cards } : current,
  );
  void queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
}

export function useMemoryCardGroupPrefetch() {
  const queryClient = useQueryClient();
  return (groupId: number) => queryClient.fetchQuery(memoryCardQueryOptions.group(groupId));
}

export function useMemoryCardCreateGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemoryCardGroup, unknown, MemoryCardGroupInput>({
    mutationFn: (input) => memoryCardsApi.createGroup(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memoryCardKeys.groups(), exact: true });
    },
  });
}

export function useMemoryCardUpdateGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemoryCardGroup, unknown, { groupId: number; input: MemoryCardGroupInput }>({
    mutationFn: ({ groupId, input }) => memoryCardsApi.updateGroup(groupId, input),
    onSuccess: (group) => {
      queryClient.setQueryData(memoryCardKeys.group(group.groupId), group);
      void queryClient.invalidateQueries({ queryKey: memoryCardKeys.groups(), exact: true });
    },
  });
}

export function useMemoryCardDeleteGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemoryCardGroupListResponse, unknown, number>({
    mutationFn: (groupId) => memoryCardsApi.deleteGroup(groupId),
    onSuccess: (response, groupId) => {
      queryClient.setQueryData(memoryCardKeys.groups(), response);
      queryClient.removeQueries({ queryKey: memoryCardKeys.group(groupId), exact: true });
    },
  });
}

export function useMemoryCardCreateCardMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemoryCardListResponse, unknown, { groupId: number; input: MemoryCardInput }>({
    mutationFn: ({ groupId, input }) => memoryCardsApi.createCard(groupId, input),
    onSuccess: (response) => setGroupCards(queryClient, response),
  });
}

export function useMemoryCardUpdateCardMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemoryCardListResponse, unknown, { cardId: number; input: MemoryCardInput }>({
    mutationFn: ({ cardId, input }) => memoryCardsApi.updateCard(cardId, input),
    onSuccess: (response) => setGroupCards(queryClient, response),
  });
}

export function useMemoryCardDeleteCardMutation() {
  const queryClient = useQueryClient();
  return useMutation<MemoryCardListResponse, unknown, number>({
    mutationFn: (cardId) => memoryCardsApi.deleteCard(cardId),
    onSuccess: (response) => setGroupCards(queryClient, response),
  });
}

export function useMemoryCardBulkImportMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    MemoryCardListResponse,
    unknown,
    { groupId: number; request: BulkMemoryCardRequest }
  >({
    mutationFn: ({ groupId, request }) => memoryCardsApi.bulkCards(groupId, request),
    onSuccess: (response) => setGroupCards(queryClient, response),
  });
}

function updateCachedMemorizedValue(
  group: MemoryCardGroup,
  cardId: number,
  memorized: boolean,
): MemoryCardGroup {
  if (!group.cards) return group;
  return {
    ...group,
    cards: group.cards.map((card) => (card.cardId === cardId ? { ...card, memorized } : card)),
  };
}

function reconcileMemorizedBatch(
  queryClient: ReturnType<typeof useQueryClient>,
  batches: Map<string, MemorizedBatch>,
  batchKey: string,
  batch: MemorizedBatch,
  queryKey: ReturnType<typeof memoryCardKeys.group>,
) {
  if (batch.operations.some((operation) => operation.status === 'pending')) {
    if (batch.baseGroup) {
      const optimisticGroup = batch.operations.reduce(
        (group, operation) =>
          operation.status === 'error'
            ? group
            : updateCachedMemorizedValue(group, operation.cardId, operation.memorized),
        batch.baseGroup,
      );
      queryClient.setQueryData(queryKey, optimisticGroup);
    }
    return;
  }

  const latestSuccess = [...batch.operations]
    .reverse()
    .find((operation) => operation.status === 'success' && operation.response);
  if (latestSuccess?.response) {
    queryClient.setQueryData<MemoryCardGroup | undefined>(queryKey, (current) =>
      current
        ? {
            ...current,
            cardCount: latestSuccess.response!.cards.length,
            cards: latestSuccess.response!.cards,
          }
        : current,
    );
  } else {
    queryClient.setQueryData(queryKey, batch.baseGroup);
  }
  void queryClient.invalidateQueries({
    queryKey,
    exact: true,
    // A mutation response is only a point-in-time snapshot. Once every
    // local operation settles, an active exact-group query must refetch so
    // backend commit order—not invocation order—wins the cache.
    refetchType: 'active',
  });
  batches.delete(batchKey);
}

/**
 * Memory Card memorized state is a Query-owned command, not a component-local
 * optimistic copy. The small batch registry keeps concurrent toggles layered
 * over one exact group cache until every request settles.
 */
export function useMemoryCardMemorizedMutation() {
  const queryClient = useQueryClient();
  const batches = useRef(new Map<string, MemorizedBatch>());
  const nextOperationId = useRef(0);

  const mutation = useMutation<
    MemoryCardListResponse,
    unknown,
    MemoryCardMemorizedVariables,
    MemorizedMutationContext
  >({
    mutationKey: memoryCardKeys.memorized(),
    mutationFn: ({ cardId, memorized }) => memoryCardsApi.updateMemorized(cardId, memorized),
    onMutate: (variables) => {
      const queryKey = memoryCardKeys.group(variables.groupId);
      // Start cancellation before the synchronous optimistic write so the
      // checkbox responds in the same event turn as the user's input.
      void queryClient.cancelQueries({ queryKey, exact: true });

      const batchKey = String(variables.groupId);
      let batch = batches.current.get(batchKey);
      if (!batch) {
        batch = {
          baseGroup: queryClient.getQueryData<MemoryCardGroup>(queryKey),
          operations: [],
        };
        batches.current.set(batchKey, batch);
      }
      const operation: MemorizedOperation = {
        ...variables,
        operationId: ++nextOperationId.current,
        status: 'pending',
      };
      batch.operations.push(operation);
      reconcileMemorizedBatch(queryClient, batches.current, batchKey, batch, queryKey);

      return { batchKey, operationId: operation.operationId, queryKey };
    },
    onSuccess: (response, _variables, context) => {
      const batch = context && batches.current.get(context.batchKey);
      const operation = batch?.operations.find(
        (candidate) => candidate.operationId === context.operationId,
      );
      if (!batch || !operation) return;
      operation.status = 'success';
      operation.response = response;
      reconcileMemorizedBatch(
        queryClient,
        batches.current,
        context.batchKey,
        batch,
        context.queryKey,
      );
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      const batch = batches.current.get(context.batchKey);
      const operation = batch?.operations.find(
        (candidate) => candidate.operationId === context.operationId,
      );
      if (!batch || !operation) return;
      operation.status = 'error';
      reconcileMemorizedBatch(
        queryClient,
        batches.current,
        context.batchKey,
        batch,
        context.queryKey,
      );
    },
  });

  return mutation;
}

export function useMemoryCardMemorizedPendingCardIds() {
  const cardIds = useMutationState<number | undefined>({
    filters: { mutationKey: memoryCardKeys.memorized(), status: 'pending' },
    select: (mutation) => {
      const variables = mutation.state.variables as MemoryCardMemorizedVariables | undefined;
      return variables?.cardId;
    },
  });
  return cardIds.filter((cardId): cardId is number => cardId !== undefined);
}
