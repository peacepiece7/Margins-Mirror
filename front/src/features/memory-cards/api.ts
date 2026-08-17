import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';
import type {
  BulkMemoryCardRequest,
  MemoryCardGroup,
  MemoryCardGroupInput,
  MemoryCardGroupListResponse,
  MemoryCardInput,
  MemoryCardListResponse,
} from '@/types/api/memory-card';

export const memoryCardsApi = {
  groups(): Promise<MemoryCardGroupListResponse> {
    return getJson('/api/memory-card-groups');
  },

  group(groupId: number): Promise<MemoryCardGroup> {
    return getJson(`/api/memory-card-groups/${groupId}`);
  },

  createGroup(request: MemoryCardGroupInput): Promise<MemoryCardGroup> {
    return postJson('/api/memory-card-groups', request);
  },

  updateGroup(groupId: number, request: MemoryCardGroupInput): Promise<MemoryCardGroup> {
    return patchJson(`/api/memory-card-groups/${groupId}`, request);
  },

  deleteGroup(groupId: number): Promise<MemoryCardGroupListResponse> {
    return deleteJson(`/api/memory-card-groups/${groupId}`);
  },

  cards(groupId: number): Promise<MemoryCardListResponse> {
    return getJson(`/api/memory-card-groups/${groupId}/cards`);
  },

  createCard(groupId: number, request: MemoryCardInput): Promise<MemoryCardListResponse> {
    return postJson(`/api/memory-card-groups/${groupId}/cards`, request);
  },

  bulkCards(groupId: number, request: BulkMemoryCardRequest): Promise<MemoryCardListResponse> {
    return postJson(`/api/memory-card-groups/${groupId}/cards/bulk`, request);
  },

  updateCard(cardId: number, request: MemoryCardInput): Promise<MemoryCardListResponse> {
    return patchJson(`/api/memory-cards/${cardId}`, request);
  },

  updateMemorized(cardId: number, memorized: boolean): Promise<MemoryCardListResponse> {
    return patchJson(`/api/memory-cards/${cardId}/memorized`, { memorized });
  },

  deleteCard(cardId: number): Promise<MemoryCardListResponse> {
    return deleteJson(`/api/memory-cards/${cardId}`);
  },
};
