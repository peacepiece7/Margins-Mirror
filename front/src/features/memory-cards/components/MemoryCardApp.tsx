import { BlueprintWorkspace } from '@/components/layouts/blueprint-workspace';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import { useMemoryCardWorkspace } from '../use-memory-card-workspace';
import { MemoryCardHeader } from './MemoryCardHeader';
import { MemoryCardStatus } from './MemoryCardStatus';
import {
  MemoryCardDetail,
  MemoryCardGroups,
  MemoryCardStudy,
  MemoryGroupIndex,
} from './MemoryCardSections';

export function MemoryCardApp() {
  const workspace = useMemoryCardWorkspace();
  const { t } = useI18n();
  const { pendingDelete, setPendingDelete } = workspace.deletion;
  const hasContent = workspace.page === 'groups' || Boolean(workspace.detail);

  return (
    <BlueprintWorkspace className="blueprint-memory-workspace">
      <MemoryCardHeader {...workspace.header} />
      <MemoryCardStatus {...workspace.status} />
      {hasContent && (
        <section
          className={`web-memory-${workspace.page}-layout`}
          {...(workspace.page === 'study' ? testAttr('memory-card-study-layout') : {})}
        >
          <MemoryGroupIndex {...workspace.index} label={t('memoryCardGroupList')} />
          {workspace.page === 'groups' && <MemoryCardGroups {...workspace.groups} />}
          {workspace.page === 'detail' && workspace.detail && (
            <MemoryCardDetail {...workspace.detail} />
          )}
          {workspace.page === 'study' && workspace.study && (
            <MemoryCardStudy {...workspace.study} />
          )}
        </section>
      )}
      <ConfirmActionDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        description={pendingDelete?.description ?? ''}
        loadingLabel={t('editorLoading')}
        onConfirm={() => pendingDelete?.onConfirm()}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(undefined);
        }}
        open={Boolean(pendingDelete)}
        title={t('delete')}
      />
    </BlueprintWorkspace>
  );
}
