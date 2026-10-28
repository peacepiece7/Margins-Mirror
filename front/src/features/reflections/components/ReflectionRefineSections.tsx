import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import type { ReflectionRefine } from '../use-reflection-refine';

export function ReflectionComparison({
  data,
  disabled,
  canUndo,
  onApply,
  onUndo,
}: ReflectionRefine['comparison']) {
  const { t } = useI18n();
  const suggestionStatus = data?.suggestionStatus;
  return (
    <div className="web-refine-comparison grid gap-3 lg:grid-cols-3">
      <section className="rounded border border-stone-300 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{t('reflectionRefineInitialTitle')}</h3>
          <Badge variant="outline">{t('reflectionRefineInitialBadge')}</Badge>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
          {data?.initialContent ?? t('reflectionRefineLoading')}
        </p>
      </section>
      <section className="rounded border border-stone-300 bg-stone-50 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{t('reflectionRefinePerspectiveTitle')}</h3>
          <Badge variant="outline">{t('reflectionRefinePrivate')}</Badge>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
          {data?.perspectiveSummary ?? t('reflectionRefineLoading')}
        </p>
      </section>
      <section className="grid gap-3 rounded border border-stone-300 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t('reflectionRefineSuggestionTitle')}</h3>
            <p className="text-sm text-stone-500">{t('reflectionRefineSuggestionDescription')}</p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {canUndo ? (
              <Button disabled={disabled} onClick={onUndo} type="button" variant="ghost">
                {t('reflectionRefineUndoSuggestion')}
              </Button>
            ) : null}
            <Button
              disabled={disabled || data?.suggestionStatus !== 'READY' || !data?.suggestedContent}
              onClick={onApply}
              type="button"
              variant="outline"
            >
              {t('reflectionRefineUseSuggestion')}
            </Button>
          </div>
        </div>
        {suggestionStatus === 'READY' && data?.suggestedContent ? (
          <p className="rounded bg-stone-50 p-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {data.suggestedContent}
          </p>
        ) : suggestionStatus === 'FAILED' ? (
          <Alert>
            <AlertTitle>{t('reflectionRefineSuggestionFailedTitle')}</AlertTitle>
            <AlertDescription>{t('reflectionRefineSuggestionFailedDescription')}</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>{t('reflectionRefineSuggestionPendingTitle')}</AlertTitle>
            <AlertDescription>{t('reflectionRefineSuggestionPendingDescription')}</AlertDescription>
          </Alert>
        )}
      </section>
    </div>
  );
}

export function ReflectionRefineEditor({
  form,
  disabled,
  isDirty,
  canSave,
  onSave,
  onKeep,
  onChange,
  status,
  keepPending,
  savePending,
}: ReflectionRefine['editor']) {
  const { t } = useI18n();
  return (
    <section className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
        <div>
          <h3 className="font-semibold">{t('reflectionRefineFinalTitle')}</h3>
          <p className="text-sm text-stone-500">{t('reflectionRefineFinalDescription')}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-600" htmlFor="refinement-outcome">
            {t('reflectionRefineOutcomeLabel')}
          </label>
          <NativeSelect
            className="mt-1"
            disabled={disabled}
            id="refinement-outcome"
            {...form.register('outcome')}
          >
            <option value="DEEPENED">{t('reflectionRefineOutcomeDeepened')}</option>
            <option value="NEW_PERSPECTIVE">{t('reflectionRefineOutcomePerspective')}</option>
            <option value="CHANGED">{t('reflectionRefineOutcomeChanged')}</option>
          </NativeSelect>
        </div>
      </div>
      <Textarea
        aria-label={t('reflectionRefineBodyLabel')}
        className="min-h-64 resize-y bg-stone-50 text-base leading-7"
        disabled={disabled}
        maxLength={20000}
        {...form.register('content', { onChange })}
        {...testAttr('refined-reflection-content')}
      />
      <p
        aria-live="polite"
        className={isDirty ? 'text-xs font-medium text-warning-ink' : 'text-xs text-stone-500'}
        id="refinement-draft-status"
        {...testAttr('refinement-draft-status')}
      >
        {status}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          aria-describedby="refinement-draft-status"
          disabled={disabled}
          onClick={onKeep}
          type="button"
          variant="outline"
          {...testAttr('reflection-keep-original')}
        >
          {keepPending ? t('reflectionRefineKeepPending') : t('reflectionRefineKeepOriginal')}
        </Button>
        <Button
          disabled={!canSave}
          onClick={onSave}
          type="button"
          {...testAttr('reflection-save-refinement')}
        >
          {savePending ? t('reflectionRefineSavePending') : t('reflectionRefineSaveRevision')}
        </Button>
      </div>
    </section>
  );
}
