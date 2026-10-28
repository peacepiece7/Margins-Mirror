import { type ChangeEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n } from '@/lib/i18n';
import type { MemoryCard, MemoryCardGroup, MemoryCardInput } from '@/types/api/memory-card';
import {
  useMemoryCardBulkImportMutation,
  useMemoryCardCreateCardMutation,
  useMemoryCardCreateGroupMutation,
  useMemoryCardDeleteCardMutation,
  useMemoryCardDeleteGroupMutation,
  useMemoryCardGroupQuery,
  useMemoryCardGroupsQuery,
  useMemoryCardMemorizedMutation,
  useMemoryCardMemorizedPendingCardIds,
  useMemoryCardUpdateCardMutation,
  useMemoryCardUpdateGroupMutation,
} from './queries';
import { memoryCardPath, useMemoryCardRouteState } from './routes';
import type { MemoryCardBulkImportValues, ParsedMemoryCardUpload } from './types';

import { cardsJson, duplicateCount, interpolate, parseUpload, templateJson } from './utils';

interface PendingDeleteAction {
  description: string;
  onConfirm: () => Promise<unknown>;
}

export function useMemoryCardWorkspace() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const route = useMemoryCardRouteState();
  const scope = useMemo(() => ({ groupId: route.groupId }), [route.groupId]);
  const activeScope = useRef<typeof scope | null>(null);
  useLayoutEffect(() => {
    activeScope.current = scope;
    return () => {
      activeScope.current = null;
    };
  }, [scope]);
  const isCurrentGroup = () => activeScope.current === scope && isCurrentSession();
  let page: 'groups' | 'study' | 'detail' = 'detail';
  if (route.mode === 'groups' || route.mode === 'new-group') {
    page = 'groups';
  } else if (route.mode === 'study') {
    page = 'study';
  }
  const groupsQuery = useMemoryCardGroupsQuery();
  const groupQuery = useMemoryCardGroupQuery(route.groupId);
  const createGroupMutation = useMemoryCardCreateGroupMutation();
  const updateGroupMutation = useMemoryCardUpdateGroupMutation();
  const deleteGroupMutation = useMemoryCardDeleteGroupMutation();
  const createCardMutation = useMemoryCardCreateCardMutation();
  const updateCardMutation = useMemoryCardUpdateCardMutation();
  const deleteCardMutation = useMemoryCardDeleteCardMutation();
  const bulkImportMutation = useMemoryCardBulkImportMutation();
  const memorizedMutation = useMemoryCardMemorizedMutation();
  const pendingMemorizedCardIds = useMemoryCardMemorizedPendingCardIds();
  const pendingMemorizedCardIdSet = useMemo(
    () => new Set(pendingMemorizedCardIds),
    [pendingMemorizedCardIds],
  );
  const groups = groupsQuery.data?.groups ?? [];
  const selectedGroup = groupQuery.data;
  const cards = useMemo(() => selectedGroup?.cards ?? [], [selectedGroup?.cards]);
  const queryLoading = groupsQuery.isLoading || groupQuery.isLoading;
  const commandLoading = [
    createGroupMutation,
    updateGroupMutation,
    deleteGroupMutation,
    createCardMutation,
    updateCardMutation,
    deleteCardMutation,
    bulkImportMutation,
  ].some((mutation) => mutation.isPending);
  const loading = queryLoading || commandLoading || pendingMemorizedCardIds.length > 0;
  const [message, setMessage] = useState<string | undefined>();
  const [operationError, setOperationError] = useState<string | undefined>();
  const [editingGroup, setEditingGroup] = useState(false);
  const uploadForm = useForm<MemoryCardBulkImportValues>({
    defaultValues: { uploadText: templateJson, duplicatePolicy: 'replace' },
  });
  const uploadText = useWatch({
    control: uploadForm.control,
    name: 'uploadText',
    defaultValue: templateJson,
  });
  const parsedUpload = useMemo(() => {
    try {
      return parseUpload(uploadText);
    } catch {
      return undefined;
    }
  }, [uploadText]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteAction | undefined>();

  const duplicates = useMemo(() => duplicateCount(cards, parsedUpload), [cards, parsedUpload]);
  const currentStudyIndex = cards.length ? studyIndex % cards.length : 0;
  const currentStudyCard = cards[currentStudyIndex];
  const memorizedCount = cards.filter((card) => card.memorized).length;
  const selectedCard = route.cardId
    ? cards.find((card) => card.cardId === route.cardId)
    : undefined;

  const queryError = groupsQuery.error
    ? apiErrorMessage(groupsQuery.error, t, 'memoryCardLoadFailed')
    : groupQuery.error
      ? apiErrorMessage(groupQuery.error, t, 'memoryCardGroupLoadFailed')
      : undefined;

  const initializedGroup = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!selectedGroup) {
      initializedGroup.current = undefined;
      return;
    }
    if (initializedGroup.current === selectedGroup.groupId) return;
    initializedGroup.current = selectedGroup.groupId;
    uploadForm.reset({
      uploadText: selectedGroup.cards?.length ? cardsJson(selectedGroup.cards) : templateJson,
      duplicatePolicy: 'replace',
    });
    setEditingGroup(false);
    setPendingDelete(undefined);
    setStudyIndex(0);
    setRevealed(false);
  }, [selectedGroup, uploadForm]);

  function clearStatus() {
    setOperationError(undefined);
    setMessage(undefined);
  }

  function applyCards(nextCards: MemoryCard[], force = false) {
    if (!force && uploadForm.getFieldState('uploadText').isDirty) return;
    uploadForm.reset({
      uploadText: cardsJson(nextCards),
      duplicatePolicy: uploadForm.getValues('duplicatePolicy'),
    });
  }

  function openGroup(groupId: number) {
    if (!isCurrentSession()) return;
    clearStatus();
    navigate(memoryCardPath('group', { groupId }));
  }

  async function submitGroup(groupForm: {
    title: string;
    description: string;
    sourceLabel: string;
  }) {
    clearStatus();
    try {
      if (selectedGroup && editingGroup) {
        await updateGroupMutation.mutateAsync({ groupId: selectedGroup.groupId, input: groupForm });
        if (!isCurrentGroup()) return;
        setEditingGroup(false);
        setMessage(t('memoryCardGroupUpdated'));
      } else {
        const created = await createGroupMutation.mutateAsync(groupForm);
        if (!isCurrentGroup()) return;
        openGroup(created.groupId);
        setMessage(t('memoryCardGroupCreated'));
      }
    } catch (submitError) {
      if (!isCurrentGroup()) return;
      setOperationError(apiErrorMessage(submitError, t, 'memoryCardGroupSaveFailed'));
    }
  }

  async function removeGroup(group: MemoryCardGroup) {
    setPendingDelete({
      description: interpolate(t('memoryCardGroupDeleteConfirm'), { title: group.title }),
      onConfirm: async () => {
        if (!isCurrentGroup()) return;
        clearStatus();
        try {
          await deleteGroupMutation.mutateAsync(group.groupId);
          if (!isCurrentGroup()) return;
          if (selectedGroup?.groupId === group.groupId) {
            navigate(memoryCardPath('groups'));
          }
        } catch (deleteError) {
          if (!isCurrentGroup()) return;
          setOperationError(apiErrorMessage(deleteError, t, 'memoryCardGroupDeleteFailed'));
          throw deleteError;
        }
      },
    });
  }

  async function submitCard(cardForm: MemoryCardInput) {
    if (!selectedGroup) {
      return;
    }
    clearStatus();
    try {
      const response =
        route.mode === 'edit-card' && route.cardId
          ? await updateCardMutation.mutateAsync({ cardId: route.cardId, input: cardForm })
          : await createCardMutation.mutateAsync({
              groupId: selectedGroup.groupId,
              input: cardForm,
            });
      if (!isCurrentGroup()) return;
      applyCards(response.cards);
      setMessage(
        route.mode === 'edit-card' ? t('memoryCardCardUpdated') : t('memoryCardCardAdded'),
      );
      navigate(memoryCardPath('cards', { groupId: selectedGroup.groupId }));
    } catch (submitError) {
      if (!isCurrentGroup()) return;
      setOperationError(apiErrorMessage(submitError, t, 'memoryCardCardSaveFailed'));
    }
  }

  async function removeCard(card: MemoryCard) {
    setPendingDelete({
      description: interpolate(t('memoryCardCardDeleteConfirm'), { title: card.frontText }),
      onConfirm: async () => {
        if (!isCurrentGroup()) return;
        clearStatus();
        try {
          const response = await deleteCardMutation.mutateAsync(card.cardId);
          if (!isCurrentGroup()) return;
          applyCards(response.cards);
        } catch (deleteError) {
          if (!isCurrentGroup()) return;
          setOperationError(apiErrorMessage(deleteError, t, 'memoryCardCardDeleteFailed'));
          throw deleteError;
        }
      },
    });
  }

  async function setCardMemorized(card: MemoryCard, memorized: boolean) {
    clearStatus();
    try {
      await memorizedMutation.mutateAsync({
        groupId: card.groupId,
        cardId: card.cardId,
        memorized,
      });
      if (!isCurrentGroup()) return;
      setMessage(t('memoryCardMemorizedSaved'));
    } catch (saveError) {
      if (!isCurrentGroup()) return;
      setOperationError(apiErrorMessage(saveError, t, 'memoryCardMemorizedSaveFailed'));
    }
  }

  function startEditCard(card: MemoryCard) {
    if (selectedGroup) {
      navigate(
        memoryCardPath('edit-card', { groupId: selectedGroup.groupId, cardId: card.cardId }),
      );
    }
  }

  async function validateUpload() {
    clearStatus();
    if (!(await uploadForm.trigger('uploadText'))) {
      return;
    }
    if (!isCurrentGroup()) return;
    try {
      const parsed = parseUpload(uploadForm.getValues('uploadText'));
      uploadForm.clearErrors('uploadText');
      setMessage(interpolate(t('memoryCardValidatedMessage'), { count: parsed.cards.length }));
    } catch (parseError) {
      if (!isCurrentGroup()) return;
      uploadForm.setError('uploadText', {
        type: 'validate',
        message: apiErrorMessage(parseError, t, 'memoryCardJsonValidationFailed'),
      });
    }
  }

  async function submitUpload({
    uploadText: formUploadText,
    duplicatePolicy: formDuplicatePolicy,
  }: MemoryCardBulkImportValues) {
    if (!selectedGroup) {
      return;
    }
    let parsed: ParsedMemoryCardUpload;
    try {
      parsed = parseUpload(formUploadText);
    } catch (parseError) {
      setMessage(undefined);
      uploadForm.setError('uploadText', {
        type: 'validate',
        message: apiErrorMessage(parseError, t, 'memoryCardJsonValidationFailed'),
      });
      return;
    }
    uploadForm.clearErrors('uploadText');
    clearStatus();
    try {
      const response = await bulkImportMutation.mutateAsync({
        groupId: selectedGroup.groupId,
        request: { duplicatePolicy: formDuplicatePolicy, cards: parsed.cards },
      });
      if (!isCurrentGroup()) return;
      applyCards(response.cards, true);
      setMessage(t('memoryCardJsonSaved'));
    } catch (submitError) {
      if (!isCurrentGroup()) return;
      setOperationError(apiErrorMessage(submitError, t, 'memoryCardBulkSaveFailed'));
    }
  }

  async function readUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      if (!isCurrentGroup()) return;
      uploadForm.setValue('uploadText', text, { shouldDirty: true, shouldValidate: true });
      uploadForm.clearErrors('uploadText');
      clearStatus();
    } catch (error) {
      if (!isCurrentGroup()) return;
      uploadForm.setError('uploadText', {
        type: 'validate',
        message: apiErrorMessage(error, t, 'memoryCardJsonValidationFailed'),
      });
    }
  }

  function startStudy() {
    clearStatus();
    setStudyIndex(0);
    setRevealed(false);
    if (selectedGroup) {
      navigate(memoryCardPath('study', { groupId: selectedGroup.groupId }));
    }
  }

  function nextStudyCard() {
    setStudyIndex((index) => (cards.length ? (index + 1) % cards.length : 0));
    setRevealed(false);
  }

  function previousStudyCard() {
    setStudyIndex((index) => (cards.length ? (index - 1 + cards.length) % cards.length : 0));
    setRevealed(false);
  }

  return {
    page,
    header: {
      canStudy: Boolean(selectedGroup && cards.length),
      onGroups: () => {
        clearStatus();
        navigate(memoryCardPath('groups'));
        void groupsQuery.refetch();
      },
      onStudy: startStudy,
    },
    status: { error: operationError ?? queryError, loading, message },
    index: {
      currentGroupId: selectedGroup?.groupId,
      groups,
      onOpen: (groupId: number) => void openGroup(groupId),
    },
    groups: { groups, commandLoading, submitGroup, removeGroup, openGroup },
    detail: selectedGroup
      ? {
          selectedGroup,
          editingGroup,
          setEditingGroup,
          commandLoading,
          submitGroup,
          selectedCard,
          route,
          cards,
          removeCard,
          startEditCard,
          setCardMemorized,
          navigate,
          pendingMemorizedCardIdSet,
          submitCard,
          bulkImport: {
            cardsCount: cards.length,
            duplicateCount: duplicates,
            form: uploadForm,
            loading,
            onFileChange: readUploadFile,
            onSubmit: submitUpload,
            onValidate: validateUpload,
            parsedUpload,
          },
        }
      : undefined,
    study: selectedGroup
      ? {
          selectedGroup,
          currentStudyCard,
          studyIndex: currentStudyIndex,
          setCardMemorized,
          nextStudyCard,
          previousStudyCard,
          setRevealed,
          revealed,
          pendingMemorizedCardIdSet,
          cards,
          memorizedCount,
          navigate,
        }
      : undefined,
    deletion: { pendingDelete, setPendingDelete },
  };
}
