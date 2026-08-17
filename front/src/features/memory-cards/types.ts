import type { MemoryCard, MemoryCardDuplicatePolicy } from '@/types/api/memory-card';

export interface ParsedMemoryCardUpload {
  cards: Array<{
    frontText: string;
    backText: string;
    exampleText?: string;
    memo?: string;
  }>;
}

export interface MemoryCardBulkImportValues {
  uploadText: string;
  duplicatePolicy: MemoryCardDuplicatePolicy;
}

export interface MemoryCardStudyState {
  index: number;
  revealed: boolean;
  cards: MemoryCard[];
}

export const memoryCardDuplicatePolicies: MemoryCardDuplicatePolicy[] = [
  'replace',
  'remove',
  'ignore',
];
