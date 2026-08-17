export interface MemoryCard {
  cardId: number;
  groupId: number;
  frontText: string;
  backText: string;
  exampleText?: string;
  memo?: string;
  memorized: boolean;
  position: number;
  updatedAt?: string;
}

export interface MemoryCardGroup {
  groupId: number;
  title: string;
  description?: string;
  sourceLabel?: string;
  cardCount: number;
  updatedAt?: string;
  cards?: MemoryCard[];
}

export interface MemoryCardGroupListResponse {
  groups: MemoryCardGroup[];
}

export interface MemoryCardListResponse {
  groupId: number;
  cards: MemoryCard[];
}

export interface MemoryCardInput {
  frontText: string;
  backText: string;
  exampleText?: string;
  memo?: string;
}

export type MemoryCardDuplicatePolicy = 'replace' | 'remove' | 'ignore';

export interface BulkMemoryCardRequest {
  duplicatePolicy: MemoryCardDuplicatePolicy;
  cards: MemoryCardInput[];
}

export interface MemoryCardGroupInput {
  title: string;
  description?: string;
  sourceLabel?: string;
}
