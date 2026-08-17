import { useMatch } from 'react-router-dom';

export type MemoryCardRouteMode =
  | 'groups'
  | 'new-group'
  | 'group'
  | 'cards'
  | 'new-card'
  | 'card'
  | 'edit-card'
  | 'upload'
  | 'study';

export interface MemoryCardRouteState {
  mode: MemoryCardRouteMode;
  groupId?: number;
  cardId?: number;
}

function positiveNumber(value: string | undefined) {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function memoryCardPath(
  mode: MemoryCardRouteMode,
  options: { groupId?: number; cardId?: number } = {},
) {
  switch (mode) {
    case 'new-group':
      return '/memory-card/groups/new';
    case 'group':
      return options.groupId ? `/memory-card/groups/${options.groupId}` : '/memory-card/groups';
    case 'cards':
      return options.groupId
        ? `/memory-card/groups/${options.groupId}/cards`
        : '/memory-card/groups';
    case 'new-card':
      return options.groupId
        ? `/memory-card/groups/${options.groupId}/cards/new`
        : '/memory-card/groups';
    case 'card':
      return options.groupId && options.cardId
        ? `/memory-card/groups/${options.groupId}/cards/${options.cardId}`
        : '/memory-card/groups';
    case 'edit-card':
      return options.groupId && options.cardId
        ? `/memory-card/groups/${options.groupId}/cards/${options.cardId}/edit`
        : '/memory-card/groups';
    case 'upload':
      return options.groupId
        ? `/memory-card/groups/${options.groupId}/upload`
        : '/memory-card/groups';
    case 'study':
      return options.groupId
        ? `/memory-card/groups/${options.groupId}/study`
        : '/memory-card/groups';
    default:
      return '/memory-card/groups';
  }
}

export function useMemoryCardRouteState(): MemoryCardRouteState {
  const groupsMatch = useMatch('/memory-card/groups');
  const newGroupMatch = useMatch('/memory-card/groups/new');
  const editCardMatch = useMatch('/memory-card/groups/:groupId/cards/:cardId/edit');
  const cardMatch = useMatch('/memory-card/groups/:groupId/cards/:cardId');
  const newCardMatch = useMatch('/memory-card/groups/:groupId/cards/new');
  const cardsMatch = useMatch('/memory-card/groups/:groupId/cards');
  const uploadMatch = useMatch('/memory-card/groups/:groupId/upload');
  const studyMatch = useMatch('/memory-card/groups/:groupId/study');
  const groupMatch = useMatch('/memory-card/groups/:groupId');

  if (newGroupMatch) return { mode: 'new-group' };
  if (editCardMatch) {
    const groupId = positiveNumber(editCardMatch.params.groupId);
    const cardId = positiveNumber(editCardMatch.params.cardId);
    if (!groupId || !cardId) return { mode: 'groups' };
    return {
      mode: 'edit-card',
      groupId,
      cardId,
    };
  }
  if (newCardMatch) {
    const groupId = positiveNumber(newCardMatch.params.groupId);
    return groupId ? { mode: 'new-card', groupId } : { mode: 'groups' };
  }
  if (cardMatch) {
    const groupId = positiveNumber(cardMatch.params.groupId);
    const cardId = positiveNumber(cardMatch.params.cardId);
    if (!groupId || !cardId) return { mode: 'groups' };
    return {
      mode: 'card',
      groupId,
      cardId,
    };
  }
  if (cardsMatch) {
    const groupId = positiveNumber(cardsMatch.params.groupId);
    return groupId ? { mode: 'cards', groupId } : { mode: 'groups' };
  }
  if (uploadMatch) {
    const groupId = positiveNumber(uploadMatch.params.groupId);
    return groupId ? { mode: 'upload', groupId } : { mode: 'groups' };
  }
  if (studyMatch) {
    const groupId = positiveNumber(studyMatch.params.groupId);
    return groupId ? { mode: 'study', groupId } : { mode: 'groups' };
  }
  if (groupMatch) {
    const groupId = positiveNumber(groupMatch.params.groupId);
    return groupId ? { mode: 'group', groupId } : { mode: 'groups' };
  }
  if (groupsMatch) return { mode: 'groups' };
  return { mode: 'groups' };
}
