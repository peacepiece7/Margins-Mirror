import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';

import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { BlueprintWorkspace } from '@/components/layouts/blueprint-workspace';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n } from '@/lib/i18n';
import type { MemoryCard, MemoryCardGroup, MemoryCardInput } from '@/types/api/memory-card';
import { testAttr } from '@/utils/testAttrs';

import {
  useMemoryCardBulkImportMutation,
  useMemoryCardCreateCardMutation,
  useMemoryCardCreateGroupMutation,
  useMemoryCardDeleteCardMutation,
  useMemoryCardDeleteGroupMutation,
  useMemoryCardGroupPrefetch,
  useMemoryCardGroupQuery,
  useMemoryCardGroupsQuery,
  useMemoryCardMemorizedMutation,
  useMemoryCardMemorizedPendingCardIds,
  useMemoryCardUpdateCardMutation,
  useMemoryCardUpdateGroupMutation,
} from '../queries';
import { memoryCardPath, useMemoryCardRouteState } from '../routes';
import type { MemoryCardBulkImportValues, ParsedMemoryCardUpload } from '../types';
import { BulkImportForm } from './BulkImportForm';
import { CardForm } from './CardForm';
import { CardDetail } from './CardDetail';
import { CardList } from './CardList';
import { GroupForm } from './GroupForm';
import { GroupListView } from './GroupListView';
import { MemoryCardHeader } from './MemoryCardHeader';
import { MemoryCardStatus } from './MemoryCardStatus';
import { StudyView } from './StudyView';

const MAX_MEMORY_CARD_UPLOAD_SIZE = 500;

interface PendingDeleteAction {
  description: string;
  onConfirm: () => Promise<unknown>;
}

const templateJson = JSON.stringify(
  {
    cards: [
      {
        frontText: 'wand',
        backText: '지팡이',
        exampleText: 'He raised his wand.',
        memo: 'Common fantasy vocabulary.',
      },
      {
        frontText: 'cloak',
        backText: '망토',
        exampleText: 'She wore a long black cloak.',
        memo: '',
      },
    ],
  },
  null,
  2,
);

function cardsJson(cards: MemoryCard[]) {
  return JSON.stringify(
    {
      cards: cards.slice(0, MAX_MEMORY_CARD_UPLOAD_SIZE).map((card) => ({
        frontText: card.frontText,
        backText: card.backText,
        exampleText: card.exampleText ?? '',
        memo: card.memo ?? '',
      })),
    },
    null,
    2,
  );
}

function displayDate(value: string | undefined, locale: 'en' | 'ko') {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US');
}

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, String(value)),
    template,
  );
}

function downloadTemplate() {
  const blob = new Blob([templateJson], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'memory-card-template.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseUpload(value: string): ParsedMemoryCardUpload {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON root must be an object');
  }
  const cards = (parsed as { cards?: unknown }).cards;
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error('cards is required');
  }
  if (cards.length > MAX_MEMORY_CARD_UPLOAD_SIZE) {
    throw new Error(`cards must contain 1 to ${MAX_MEMORY_CARD_UPLOAD_SIZE} items`);
  }
  cards.forEach((card, index) => {
    if (!card || typeof card !== 'object') {
      throw new Error(`cards[${index}] must be an object`);
    }
    const candidate = card as Record<string, unknown>;
    if (typeof candidate.frontText !== 'string' || !candidate.frontText.trim()) {
      throw new Error(`cards[${index}].frontText is required`);
    }
    if (candidate.frontText.trim().length > 200) {
      throw new Error(`cards[${index}].frontText must be 200 characters or less`);
    }
    if (typeof candidate.backText !== 'string' || !candidate.backText.trim()) {
      throw new Error(`cards[${index}].backText is required`);
    }
    if (candidate.backText.trim().length > 500) {
      throw new Error(`cards[${index}].backText must be 500 characters or less`);
    }
    if (typeof candidate.exampleText === 'string' && candidate.exampleText.trim().length > 1000) {
      throw new Error(`cards[${index}].exampleText must be 1000 characters or less`);
    }
    if (typeof candidate.memo === 'string' && candidate.memo.trim().length > 1000) {
      throw new Error(`cards[${index}].memo must be 1000 characters or less`);
    }
  });
  return {
    cards: cards.map((card) => {
      const item = card as Record<string, string | undefined>;
      return {
        frontText: item.frontText?.trim() ?? '',
        backText: item.backText?.trim() ?? '',
        exampleText: item.exampleText?.trim() || undefined,
        memo: item.memo?.trim() || undefined,
      };
    }),
  };
}

function duplicateCount(cards: MemoryCard[], upload: ParsedMemoryCardUpload | undefined) {
  if (!upload) {
    return 0;
  }
  const existing = new Set(cards.map((card) => card.frontText.trim().toLowerCase()));
  return upload.cards.filter((card) => existing.has(card.frontText.trim().toLowerCase())).length;
}

export function MemoryCardApp() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const route = useMemoryCardRouteState();
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
  const prefetchGroup = useMemoryCardGroupPrefetch();
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
  const currentStudyCard = cards[studyIndex];
  const selectedCard = route.cardId
    ? cards.find((card) => card.cardId === route.cardId)
    : undefined;
  const showCardForm = route.mode === 'new-card' || route.mode === 'edit-card' || page === 'detail';
  const showUpload = route.mode === 'upload' || page === 'detail';

  useEffect(() => {
    if (groupsQuery.error) {
      setOperationError(apiErrorMessage(groupsQuery.error, t, 'memoryCardLoadFailed'));
    } else if (groupQuery.error) {
      setOperationError(apiErrorMessage(groupQuery.error, t, 'memoryCardGroupLoadFailed'));
    }
  }, [groupQuery.error, groupsQuery.error, t]);

  useEffect(() => {
    if (!selectedGroup) return;
    applyCards(selectedGroup.cards ?? [], { forceUploadSync: true, useTemplateWhenEmpty: true });
    setEditingGroup(false);
    // Authoritative query data resets route-bound form defaults and generated upload content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.groupId]);

  function clearStatus() {
    setOperationError(undefined);
    setMessage(undefined);
  }

  function applyCards(
    nextCards: MemoryCard[],
    options: { forceUploadSync?: boolean; useTemplateWhenEmpty?: boolean } = {},
  ) {
    if (options.forceUploadSync || !uploadForm.getFieldState('uploadText').isDirty) {
      const emptyUploadText = options.useTemplateWhenEmpty ? templateJson : cardsJson([]);
      uploadForm.reset({
        uploadText: nextCards.length ? cardsJson(nextCards) : emptyUploadText,
        duplicatePolicy: uploadForm.getValues('duplicatePolicy'),
      });
    }
  }

  async function loadGroups() {
    clearStatus();
    try {
      const result = await groupsQuery.refetch();
      if (!isCurrentSession()) return;
      if (result.error) {
        setOperationError(apiErrorMessage(result.error, t, 'memoryCardLoadFailed'));
      }
    } catch (loadError) {
      if (!isCurrentSession()) return;
      setOperationError(apiErrorMessage(loadError, t, 'memoryCardLoadFailed'));
    }
  }

  async function openGroup(groupId: number, options: { replaceRoute?: boolean } = {}) {
    if (!isCurrentSession()) return;
    clearStatus();
    try {
      await prefetchGroup(groupId);
      if (!isCurrentSession()) return;
      if (options.replaceRoute !== false) {
        navigate(memoryCardPath('group', { groupId }));
      }
    } catch (openError) {
      if (!isCurrentSession()) return;
      setOperationError(apiErrorMessage(openError, t, 'memoryCardGroupLoadFailed'));
    }
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
        if (!isCurrentSession()) return;
        setEditingGroup(false);
        setMessage(t('memoryCardGroupUpdated'));
      } else {
        const created = await createGroupMutation.mutateAsync(groupForm);
        if (!isCurrentSession()) return;
        await openGroup(created.groupId);
        if (!isCurrentSession()) return;
        setMessage(t('memoryCardGroupCreated'));
      }
    } catch (submitError) {
      if (!isCurrentSession()) return;
      setOperationError(apiErrorMessage(submitError, t, 'memoryCardGroupSaveFailed'));
    }
  }

  async function removeGroup(group: MemoryCardGroup) {
    setPendingDelete({
      description: interpolate(t('memoryCardGroupDeleteConfirm'), { title: group.title }),
      onConfirm: async () => {
        if (!isCurrentSession()) return;
        clearStatus();
        try {
          await deleteGroupMutation.mutateAsync(group.groupId);
          if (!isCurrentSession()) return;
          if (selectedGroup?.groupId === group.groupId) {
            navigate(memoryCardPath('groups'));
          }
        } catch (deleteError) {
          if (!isCurrentSession()) return;
          setOperationError(apiErrorMessage(deleteError, t, 'memoryCardGroupDeleteFailed'));
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
      if (!isCurrentSession()) return;
      applyCards(response.cards);
      setMessage(
        route.mode === 'edit-card' ? t('memoryCardCardUpdated') : t('memoryCardCardAdded'),
      );
      navigate(memoryCardPath('cards', { groupId: selectedGroup.groupId }));
    } catch (submitError) {
      if (!isCurrentSession()) return;
      setOperationError(apiErrorMessage(submitError, t, 'memoryCardCardSaveFailed'));
    }
  }

  async function removeCard(card: MemoryCard) {
    setPendingDelete({
      description: interpolate(t('memoryCardCardDeleteConfirm'), { title: card.frontText }),
      onConfirm: async () => {
        if (!isCurrentSession()) return;
        clearStatus();
        try {
          const response = await deleteCardMutation.mutateAsync(card.cardId);
          if (!isCurrentSession()) return;
          applyCards(response.cards);
        } catch (deleteError) {
          if (!isCurrentSession()) return;
          setOperationError(apiErrorMessage(deleteError, t, 'memoryCardCardDeleteFailed'));
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
      if (!isCurrentSession()) return;
      setMessage(t('memoryCardMemorizedSaved'));
    } catch (saveError) {
      if (!isCurrentSession()) return;
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
    if (!isCurrentSession()) return;
    try {
      const parsed = parseUpload(uploadForm.getValues('uploadText'));
      uploadForm.clearErrors('uploadText');
      setMessage(interpolate(t('memoryCardValidatedMessage'), { count: parsed.cards.length }));
    } catch (parseError) {
      if (!isCurrentSession()) return;
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
      if (!isCurrentSession()) return;
      applyCards(response.cards, { forceUploadSync: true });
      setMessage(t('memoryCardJsonSaved'));
    } catch (submitError) {
      if (!isCurrentSession()) return;
      setOperationError(apiErrorMessage(submitError, t, 'memoryCardBulkSaveFailed'));
    }
  }

  async function readUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    if (!isCurrentSession()) return;
    uploadForm.setValue('uploadText', text, { shouldDirty: true, shouldValidate: true });
    uploadForm.clearErrors('uploadText');
    clearStatus();
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

  return (
    <BlueprintWorkspace className="blueprint-memory-workspace">
      <MemoryCardHeader
        canStudy={Boolean(selectedGroup && cards.length)}
        onGroups={() => {
          navigate(memoryCardPath('groups'));
          void loadGroups();
        }}
        onStudy={startStudy}
      />
      <MemoryCardStatus error={operationError} loading={loading} message={message} />

      {page === 'groups' && (
        <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <GroupListView
            deleteLabel={t('delete')}
            emptyLabel={t('memoryCardEmptyGroups')}
            groups={groups}
            onDelete={(group) => void removeGroup(group)}
            onOpen={(group) => void openGroup(group.groupId)}
            openLabel={t('memoryCardOpen')}
            rowDescription={(group) =>
              group.description || group.sourceLabel || t('memoryCardNoDescription')
            }
            rowMeta={(group) =>
              interpolate(t('memoryCardGroupMeta'), {
                count: group.cardCount,
                date: displayDate(group.updatedAt, locale),
              })
            }
          />
          <div className="grid content-start gap-4">
            <GroupForm
              initialValues={{ title: '', description: '', sourceLabel: '' }}
              loading={commandLoading}
              onSubmit={submitGroup}
              title={t('memoryCardNewGroup')}
            />
          </div>
        </section>
      )}

      {page === 'detail' && selectedGroup && (
        <section className="grid gap-5">
          <div className="grid gap-3 rounded border border-stone-300 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-2xl font-semibold">{selectedGroup.title}</h2>
                <p className="break-words text-sm text-stone-600">
                  {selectedGroup.description ||
                    selectedGroup.sourceLabel ||
                    t('memoryCardNoDescription')}
                </p>
              </div>
              <Button
                className="min-h-11 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:border-stone-900"
                onClick={() => setEditingGroup((value) => !value)}
                type="button"
                {...testAttr('memory-card-group-edit-toggle')}
              >
                {t('memoryCardGroupEdit')}
              </Button>
            </div>
            {editingGroup && (
              <GroupForm
                initialValues={{
                  title: selectedGroup.title,
                  description: selectedGroup.description ?? '',
                  sourceLabel: selectedGroup.sourceLabel ?? '',
                }}
                loading={commandLoading}
                onSubmit={submitGroup}
                title={t('memoryCardGroupEdit')}
              />
            )}
          </div>

          {selectedCard && route.mode === 'card' && <CardDetail card={selectedCard} />}

          {showCardForm && (
            <CardForm
              editing={route.mode === 'edit-card'}
              initialValues={{
                frontText: route.mode === 'edit-card' ? (selectedCard?.frontText ?? '') : '',
                backText: route.mode === 'edit-card' ? (selectedCard?.backText ?? '') : '',
                exampleText: route.mode === 'edit-card' ? (selectedCard?.exampleText ?? '') : '',
                memo: route.mode === 'edit-card' ? (selectedCard?.memo ?? '') : '',
              }}
              loading={commandLoading}
              onCancel={() => navigate(memoryCardPath('cards', { groupId: selectedGroup.groupId }))}
              onSubmit={submitCard}
            />
          )}

          {showUpload && (
            <BulkImportForm
              cardsCount={cards.length}
              duplicateCount={duplicates}
              form={uploadForm}
              labels={{
                description: t('memoryCardBulkDescription'),
                duplicateHandling: t('memoryCardDuplicateHandling'),
                duplicateIgnore: t('memoryCardDuplicateIgnore'),
                duplicateRemove: t('memoryCardDuplicateRemove'),
                duplicateReplace: t('memoryCardDuplicateReplace'),
                existingDuplicates: t('memoryCardExistingDuplicates'),
                fileUpload: t('memoryCardFileUpload'),
                limitNotice: interpolate(t('memoryCardPrefillLimitNotice'), {
                  count: cards.length,
                  limit: MAX_MEMORY_CARD_UPLOAD_SIZE,
                }),
                requiredField: t('requiredField'),
                save: t('memoryCardSave'),
                templateDownload: t('memoryCardTemplateDownload'),
                title: t('memoryCardBulkTitle'),
                validate: t('memoryCardJsonValidate'),
                validatedCards: t('memoryCardValidatedCards'),
              }}
              loading={loading}
              maxUploadSize={MAX_MEMORY_CARD_UPLOAD_SIZE}
              onDownloadTemplate={downloadTemplate}
              onFileChange={(event) => void readUploadFile(event)}
              onSubmit={submitUpload}
              onValidate={validateUpload}
              parsedUpload={parsedUpload}
            />
          )}

          <CardList
            cards={cards}
            labels={{
              delete: t('delete'),
              edit: t('edit'),
              memorized: t('memoryCardMemorized'),
              open: t('memoryCardOpen'),
            }}
            onDelete={(card) => void removeCard(card)}
            onEdit={startEditCard}
            onMemorizedChange={(card, memorized) => void setCardMemorized(card, memorized)}
            onOpen={(card) =>
              navigate(
                memoryCardPath('card', {
                  groupId: selectedGroup.groupId,
                  cardId: card.cardId,
                }),
              )
            }
            savingMemorizedCardIds={pendingMemorizedCardIdSet}
          />
        </section>
      )}

      {page === 'study' && selectedGroup && (
        <StudyView
          card={currentStudyCard}
          labels={{
            backToGroup: t('memoryCardBackToGroup'),
            meaningHidden: t('memoryCardMeaningHidden'),
            memorized: t('memoryCardMemorized'),
            memorizedCount: t('memoryCardMemorizedCount'),
            nextCard: t('memoryCardNextCard'),
            noCards: t('memoryCardNoStudyCards'),
            revealMeaning: t('memoryCardRevealMeaning'),
          }}
          memorizedCount={cards.filter((card) => card.memorized).length}
          onBack={() => navigate(memoryCardPath('group', { groupId: selectedGroup.groupId }))}
          onMemorizedChange={(card, memorized) => void setCardMemorized(card, memorized)}
          onNext={nextStudyCard}
          onReveal={() => setRevealed(true)}
          revealed={revealed}
          savingMemorizedCardIds={pendingMemorizedCardIdSet}
          totalCount={cards.length}
        />
      )}
      <ConfirmActionDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        description={pendingDelete?.description ?? ''}
        loadingLabel={t('editorLoading')}
        onConfirm={() => pendingDelete?.onConfirm()}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(undefined);
          }
        }}
        open={Boolean(pendingDelete)}
        title={t('delete')}
      />
    </BlueprintWorkspace>
  );
}
