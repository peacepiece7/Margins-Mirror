export type MemoryCard = {
  cardId: number;
  groupId: number;
  frontText: string;
  backText: string;
  exampleText?: string;
  memo?: string;
  memorized: boolean;
  position: number;
  updatedAt?: string;
};
export type MemoryCardGroup = {
  groupId: number;
  bookId?: number | null;
  title: string;
  description?: string;
  sourceLabel?: string;
  cardCount: number;
  updatedAt?: string;
  cards?: MemoryCard[];
};
export type MemoryCardGroupList = { groups: MemoryCardGroup[] };
export type MemoryCardList = { groupId: number; cards: MemoryCard[] };
export type MemoryCardInput = {
  frontText: string;
  backText: string;
  exampleText?: string;
  memo?: string;
};
export type MemoryCardGroupInput = {
  title: string;
  bookId?: number;
  description?: string;
  sourceLabel?: string;
};
export type DuplicatePolicy = "replace" | "remove" | "ignore";
