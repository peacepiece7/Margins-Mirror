import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import type { DiscussionGuide } from '../use-discussion-guide';

export function DiscussionGuideActions({
  data,
  draftActive,
  pending,
  projectionType,
  validationMessage,
  editedMinutes,
  canEdit,
  canSave,
  onEdit,
  onCancel,
  onSave,
  savePending,
  runPending,
  canStart,
  onStart,
  regenerate,
}: DiscussionGuide['actions']) {
  const { t } = useI18n();
  return (
    <>
      {data?.current && (
        <section className="flex flex-col gap-3 rounded border border-stone-300 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold">{t('reflectionGuideEditTitle')}</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              {projectionType === 'PARTICIPANT'
                ? t('reflectionGuideEditParticipantDescription')
                : t('reflectionGuideEditFacilitatorDescription')}
              {draftActive
                ? ` ${t('reflectionGuideEditMinutes')
                    .replace('{edited}', String(editedMinutes))
                    .replace('{target}', String(data.targetMinutes))}`
                : ''}
            </p>
            {draftActive && validationMessage ? (
              <p
                aria-live="polite"
                className="mt-2 text-sm font-medium leading-6 text-warning-ink"
                id="discussion-guide-edit-validation"
              >
                {validationMessage}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 min-[390px]:grid-cols-2 sm:flex">
            {draftActive ? (
              <>
                <Button
                  className="min-h-11 whitespace-normal"
                  disabled={pending}
                  onClick={onCancel}
                  type="button"
                  variant="outline"
                >
                  {t('reflectionGuideEditCancel')}
                </Button>
                <Button
                  aria-describedby={
                    validationMessage ? 'discussion-guide-edit-validation' : undefined
                  }
                  className="min-h-11 whitespace-normal"
                  disabled={!canSave}
                  onClick={onSave}
                  type="button"
                  {...testAttr('discussion-guide-save-version')}
                >
                  {savePending ? t('reflectionGuideEditSaving') : t('reflectionGuideEditSave')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="min-h-11 whitespace-normal"
                  disabled={!canEdit}
                  onClick={onEdit}
                  type="button"
                  variant="outline"
                  {...testAttr('discussion-guide-edit')}
                >
                  {t('reflectionGuideEditDirect')}
                </Button>
                <Button
                  className="min-h-11 whitespace-normal"
                  disabled={!canEdit}
                  onClick={() => regenerate.onOpenChange(true)}
                  type="button"
                  {...testAttr('discussion-guide-regenerate')}
                >
                  {t('reflectionGuideRegenerate')}
                </Button>
                <ConfirmActionDialog
                  open={regenerate.open}
                  onOpenChange={regenerate.onOpenChange}
                  onConfirm={regenerate.onConfirm}
                  title={t('reflectionGuideRegenerateTitle')}
                  description={
                    regenerate.error
                      ? t('reflectionGuideOperationErrorDescription')
                      : t('reflectionGuideRegenerateDescription').replace(
                          '{version}',
                          String(data.guideVersion),
                        )
                  }
                  cancelLabel={t('cancel')}
                  confirmLabel={t('reflectionGuideRegenerateConfirm')}
                />
              </>
            )}
          </div>
        </section>
      )}
      <div className="sticky bottom-2 z-10 flex justify-end rounded border border-stone-300 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-3">
        <Button
          className="min-h-11 w-full whitespace-normal sm:w-auto"
          disabled={!canStart}
          onClick={onStart}
          type="button"
          {...testAttr('discussion-start-run')}
        >
          {runPending
            ? t('reflectionGuideRunPreparing')
            : data?.runId
              ? t('reflectionGuideRunResume')
              : data && !data.current
                ? t('reflectionGuideRunArchived')
                : t('reflectionGuideRunStart')}
        </Button>
      </div>
    </>
  );
}
