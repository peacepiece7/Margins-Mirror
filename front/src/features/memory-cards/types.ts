import type {
  MemoryCard,
  MemoryCardGroup,
  MemoryCardDuplicatePolicy,
} from '@/types/api/memory-card';
import type { useMemoryCardWorkspace } from './use-memory-card-workspace';

export type MemoryCardWorkspace = ReturnType<typeof useMemoryCardWorkspace>;

export type GroupFormValues = { title: string; description: string; sourceLabel: string };
export type MemoryGroupIndexProps = {
  currentGroupId?: number;
  groups: MemoryCardGroup[];
  label: string;
  onOpen: (groupId: number) => void;
};

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
