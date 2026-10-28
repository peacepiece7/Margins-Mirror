import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import type { PrimaryReflection } from '../use-primary-reflection';
import { DeveloperDraftControl } from './DeveloperDraftControl';
import { ReflectionOperationStatus } from './ReflectionOperationStatus';

export function PrimaryReflectionFeedback({
  runId,
  runCompleted,
  missingReflection,
  error,
  onRetry,
}: PrimaryReflection['feedback']) {
  const { t } = useI18n();
  return (
    <>
      <Alert className="border-stone-300 bg-stone-50">
        <AlertTitle>{t('reflectionVisibilityTitle')}</AlertTitle>
        <AlertDescription>{t('reflectionVisibilityDescription')}</AlertDescription>
      </Alert>
      {runId ? (
        <Alert {...testAttr('reflection-run-recovery')}>
          <AlertTitle>
            {runCompleted ? t('reflectionRunCompletedTitle') : t('reflectionRunActiveTitle')}
          </AlertTitle>
          <AlertDescription>
            {runCompleted
              ? t('reflectionRunCompletedDescription')
              : t('reflectionRunActiveDescription')}
          </AlertDescription>
        </Alert>
      ) : null}
      {missingReflection ? (
        <Alert role="status" variant="warning">
          <AlertTitle>{t('reflectionComposeMissingTitle')}</AlertTitle>
          <AlertDescription>{t('reflectionComposeMissingDescription')}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <ReflectionOperationStatus
          message={t('reflectionOperationErrorDescription')}
          onRetry={onRetry}
          retryLabel={t('reflectionReload')}
          title={t('reflectionOperationErrorTitle')}
        />
      ) : null}
    </>
  );
}

export function PrimaryReflectionEditor({
  bookId,
  form,
  content,
  disabled,
  busy,
  isDirty,
  draftKey,
  onSubmit,
  onResume,
  onChange,
  onGenerated,
  canSave,
  canResume,
  status,
  saveLabel,
  resumeLabel,
}: PrimaryReflection['editor']) {
  const { t } = useI18n();
  return (
    <form
      aria-busy={busy}
      className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:p-6"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">{t('reflectionPrimaryTitle')}</h3>
          <p className="text-sm text-stone-500">{t('reflectionPrimaryDescription')}</p>
        </div>
        <NativeSelect
          aria-label={t('reflectionVisibilityLabel')}
          className="sm:w-44"
          disabled={disabled}
          {...form.register('visibility', { onChange })}
        >
          <option value="PRIVATE">{t('reflectionVisibilityPrivate')}</option>
          <option value="PUBLIC">{t('reflectionVisibilityPublic')}</option>
        </NativeSelect>
      </div>
      <Textarea
        aria-label={t('reflectionBodyLabel')}
        className="min-h-64 resize-y bg-stone-50 text-base leading-7"
        maxLength={20000}
        disabled={disabled}
        {...form.register('content', { onChange })}
        placeholder={t('reflectionBodyPlaceholder')}
        {...testAttr('primary-reflection-content')}
      />
      <DeveloperDraftControl
        bookId={bookId}
        draftKey={draftKey}
        context={content}
        disabled={disabled}
        onGenerated={onGenerated}
        target="PRIMARY_REFLECTION"
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <span className="text-xs text-stone-500">
            {t('reflectionCharacterLimit').replace(
              '{count}',
              content.trim().length.toLocaleString(),
            )}
          </span>
          <span
            aria-live="polite"
            className={isDirty ? 'text-xs font-medium text-warning-ink' : 'text-xs text-stone-500'}
            id="reflection-save-status"
            {...testAttr('reflection-save-status')}
          >
            {status}
          </span>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button
            aria-describedby="reflection-save-status"
            disabled={!canResume}
            onClick={onResume}
            type="button"
            variant="outline"
            {...testAttr('reflection-start-interview')}
          >
            {resumeLabel}
          </Button>
          <Button disabled={!canSave} type="submit" {...testAttr('primary-reflection-save')}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ReflectionRevisionHistory({ revisions }: PrimaryReflection['history']) {
  const { t } = useI18n();
  if (!revisions.length) return null;
  return (
    <section className="web-reflection-revisions rounded border border-stone-300 bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t('reflectionRevisionHistoryTitle')}</h3>
          <p className="text-sm text-stone-500">{t('reflectionRevisionHistoryDescription')}</p>
        </div>
        <Badge variant="outline">
          {t('reflectionRevisionCount').replace('{count}', String(revisions.length))}
        </Badge>
      </div>
      <ol className="mt-4 grid gap-2">
        {revisions.map((revision, index) => (
          <li
            className="grid gap-1 rounded border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[7rem_minmax(0,1fr)]"
            id={`reflection-revision-${revision.revisionId}`}
            key={revision.revisionId}
          >
            <span className="text-xs font-semibold text-stone-500">
              v{revision.version} ·{' '}
              {index === 0 ? t('reflectionGuideCurrent') : revision.revisionSource}
            </span>
            <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-6">{revision.content}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
