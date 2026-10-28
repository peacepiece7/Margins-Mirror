import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import type { MemoryCardWorkspace, MemoryGroupIndexProps } from '../types';
import { testAttr } from '@/utils/testAttrs';
import { memoryCardPath } from '../routes';
import { BulkImportForm } from './BulkImportForm';
import { CardForm } from './CardForm';
import { CardDetail } from './CardDetail';
import { CardList } from './CardList';
import { GroupForm } from './GroupForm';
import { GroupListView } from './GroupListView';
import { StudyProgress } from './StudyProgress';
import { StudyView } from './StudyView';

export function MemoryGroupIndex({ currentGroupId, groups, label, onOpen }: MemoryGroupIndexProps) {
  return (
    <aside className="web-memory-group-index" {...testAttr('memory-card-group-index')}>
      <span className="blueprint-unit-label">GROUPS</span>
      <h2>{label}</h2>
      <nav aria-label={label}>
        {groups.map((group) => (
          <Button
            aria-current={currentGroupId === group.groupId ? 'page' : undefined}
            className="h-auto w-full rounded-none"
            key={group.groupId}
            onClick={() => onOpen(group.groupId)}
            type="button"
            variant="ghost"
          >
            <span>{group.title}</span>
            <small>{group.cardCount}</small>
          </Button>
        ))}
      </nav>
    </aside>
  );
}

export function MemoryCardGroups({
  groups,
  commandLoading,
  submitGroup,
  removeGroup,
  openGroup,
}: MemoryCardWorkspace['groups']) {
  const { t } = useI18n();
  return (
    <>
      <div className="web-memory-groups-main">
        <GroupListView
          groups={groups}
          onDelete={(group) => void removeGroup(group)}
          onOpen={(group) => void openGroup(group.groupId)}
        />
      </div>
      <aside className="web-memory-tools">
        <GroupForm
          initialValues={{ title: '', description: '', sourceLabel: '' }}
          loading={commandLoading}
          onSubmit={submitGroup}
          title={t('memoryCardNewGroup')}
        />
      </aside>
    </>
  );
}

export function MemoryCardDetail({
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
  bulkImport,
}: NonNullable<MemoryCardWorkspace['detail']>) {
  const { t } = useI18n();
  return (
    <>
      <div className="web-memory-detail-main">
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
              className="min-h-11 px-3 py-2"
              onClick={() => setEditingGroup((value) => !value)}
              type="button"
              variant="outline"
              {...testAttr('memory-card-group-edit-toggle')}
            >
              {t('memoryCardGroupEdit')}
            </Button>
          </div>
          {editingGroup && (
            <GroupForm
              key={selectedGroup.groupId}
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

        <CardList
          cards={cards}
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
      </div>

      <aside className="web-memory-tools">
        <CardForm
          key={`${selectedGroup.groupId}:${route.mode}:${route.cardId ?? 'new'}`}
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

        <BulkImportForm {...bulkImport} />
      </aside>
    </>
  );
}

export function MemoryCardStudy({
  selectedGroup,
  currentStudyCard,
  studyIndex,
  setCardMemorized,
  nextStudyCard,
  previousStudyCard,
  setRevealed,
  revealed,
  pendingMemorizedCardIdSet,
  cards,
  memorizedCount,
  navigate,
}: NonNullable<MemoryCardWorkspace['study']>) {
  const { t } = useI18n();
  return (
    <>
      <div className="web-memory-study-main">
        <StudyView
          card={currentStudyCard}
          currentIndex={studyIndex}
          onMemorizedChange={(card, memorized) => void setCardMemorized(card, memorized)}
          onNext={nextStudyCard}
          onPrevious={previousStudyCard}
          onReveal={() => setRevealed(true)}
          revealed={revealed}
          savingMemorizedCardIds={pendingMemorizedCardIdSet}
          totalCount={cards.length}
        />
      </div>
      <aside className="web-memory-study-summary" {...testAttr('memory-card-study-summary')}>
        <span className="blueprint-unit-label">STUDY</span>
        <h2>{t('memoryCardStudySummary')}</h2>
        <p>{selectedGroup.title}</p>
        <StudyProgress
          label={`${memorizedCount}/${cards.length} ${t('memoryCardMemorizedCount')}`}
        />
        <dl>
          <div>
            <dt>{t('memoryCardTotalCount')}</dt>
            <dd>{cards.length}</dd>
          </div>
          <div>
            <dt>{t('memoryCardMemorized')}</dt>
            <dd>{memorizedCount}</dd>
          </div>
          <div>
            <dt>{t('memoryCardRemainingCount')}</dt>
            <dd>{cards.length - memorizedCount}</dd>
          </div>
        </dl>
        <Button
          className="w-full rounded-none"
          onClick={() => navigate(memoryCardPath('group', { groupId: selectedGroup.groupId }))}
          type="button"
          variant="outline"
        >
          {t('memoryCardBackToGroup')}
        </Button>
      </aside>
    </>
  );
}
