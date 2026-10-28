import type { ApiClient } from "@/shared/api/client";

import type {
  DuplicatePolicy,
  MemoryCardGroup,
  MemoryCardGroupInput,
  MemoryCardGroupList,
  MemoryCardInput,
  MemoryCardList,
} from "./types";

export function createMemoryCardsApi(client: ApiClient) {
  return {
    groups: (bookId?: number) => client.get<MemoryCardGroupList>(
      bookId === undefined
        ? "/api/memory-card-groups"
        : `/api/memory-card-groups?bookId=${encodeURIComponent(bookId)}`,
    ),
    group: (groupId: number) =>
      client.get<MemoryCardGroup>(`/api/memory-card-groups/${groupId}`),
    createGroup: (input: MemoryCardGroupInput) =>
      client.post<MemoryCardGroup>("/api/memory-card-groups", input),
    updateGroup: (groupId: number, input: MemoryCardGroupInput) =>
      client.patch<MemoryCardGroup>(
        `/api/memory-card-groups/${groupId}`,
        input,
      ),
    deleteGroup: (groupId: number) =>
      client.delete<MemoryCardGroupList>(`/api/memory-card-groups/${groupId}`),
    createCard: (groupId: number, input: MemoryCardInput) =>
      client.post<MemoryCardList>(
        `/api/memory-card-groups/${groupId}/cards`,
        input,
      ),
    bulkCards: (
      groupId: number,
      cards: MemoryCardInput[],
      duplicatePolicy: DuplicatePolicy,
    ) =>
      client.post<MemoryCardList>(
        `/api/memory-card-groups/${groupId}/cards/bulk`,
        { cards, duplicatePolicy },
      ),
    updateCard: (cardId: number, input: MemoryCardInput) =>
      client.patch<MemoryCardList>(`/api/memory-cards/${cardId}`, input),
    memorize: (cardId: number, memorized: boolean) =>
      client.patch<MemoryCardList>(`/api/memory-cards/${cardId}/memorized`, {
        memorized,
      }),
    deleteCard: (cardId: number) =>
      client.delete<MemoryCardList>(`/api/memory-cards/${cardId}`),
  };
}
