import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ApiRequestError } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import type { ReflectionVisibility } from '@/types/api/reflection-loop';

import { useReflectionSessionForBook } from '../queries';
import {
  useSessionReflectionQuery,
  useSavePrimaryReflectionMutation,
  useStartReflectionInterviewMutation,
} from '../reflection-loop-queries';
import { reflectionErrorMessage } from '../reflection-loop-ui';
import { ReflectionLoopProgress } from './ReflectionLoopProgress';
import { ReflectionOperationStatus } from './ReflectionOperationStatus';

export function ReflectionLoopPanel({ bookId }: { bookId: number }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { sessionId, sessions } = useReflectionSessionForBook(bookId);
  const reflection = useSessionReflectionQuery(sessionId);
  const save = useSavePrimaryReflectionMutation(bookId, sessionId, reflection.data?.reflectionId);
  const startInterview = useStartReflectionInterviewMutation();
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<ReflectionVisibility>('PRIVATE');
  const persistedBaseline = useRef<{
    content: string;
    visibility: ReflectionVisibility;
  }>({ content: '', visibility: 'PRIVATE' });

  const persistedContent = reflection.data?.currentRevision.content ?? '';
  const persistedVisibility = reflection.data?.visibility ?? 'PRIVATE';

  useEffect(() => {
    const previous = persistedBaseline.current;
    setContent((current) => (current === previous.content ? persistedContent : current));
    setVisibility((current) => (current === previous.visibility ? persistedVisibility : current));
    persistedBaseline.current = {
      content: persistedContent,
      visibility: persistedVisibility,
    };
  }, [persistedContent, persistedVisibility]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextContent = content.trim();
    if (!nextContent || save.isPending) return;
    save.mutate({
      content: nextContent,
      title: 'Reflection',
      visibility,
    });
  }

  const savedReflectionId = reflection.data?.reflectionId;
  const interviewId = reflection.data?.activeInterviewId;
  const guideId = reflection.data?.guideId;
  const runId = reflection.data?.runId;
  const runCompleted = reflection.data?.runStatus === 'COMPLETED';
  const workflowTarget = runId
    ? {
        label: runCompleted ? t('reflectionRefineResume') : t('reflectionDiscussionResume'),
        path: `/book/${bookId}/reflection/${runCompleted ? 'refine' : 'discuss'}/${runId}`,
      }
    : guideId
      ? {
          label: t('reflectionGuideViewCurrent'),
          path: `/book/${bookId}/reflection/guide/${guideId}`,
        }
      : interviewId
        ? {
            label: t('reflectionInterviewResume'),
            path: `/book/${bookId}/reflection/interview`,
          }
        : null;
  const normalizedContent = content.trim();
  const isDirty =
    normalizedContent !== persistedContent.trim() || visibility !== persistedVisibility;
  const pending =
    sessions.isLoading || reflection.isFetching || save.isPending || startInterview.isPending;
  const missingReflection =
    reflection.error instanceof ApiRequestError && reflection.error.status === 404;
  const loadError = sessions.error ?? (missingReflection ? null : reflection.error);
  const operationError = loadError ?? save.error ?? startInterview.error;
  const editorStatus = save.isPending
    ? t('reflectionEditorSaving')
    : isDirty
      ? t('reflectionEditorUnsaved')
      : savedReflectionId
        ? t('reflectionEditorSaved')
        : t('reflectionEditorStart');

  return (
    <section
      className="web-reflection-page web-reflection-compose grid gap-5"
      {...testAttr('reflection-loop-page')}
    >
      <ReflectionLoopProgress active="reflect" bookId={bookId} />
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">REFLECT / MVP2</p>
        <h2 className="text-2xl font-semibold tracking-tight">{t('reflectionComposeTitle')}</h2>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          {t('reflectionComposeDescription')}
        </p>
      </header>

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

      {operationError ? (
        <ReflectionOperationStatus
          message={reflectionErrorMessage(operationError, t('reflectionOperationErrorDescription'))}
          onRetry={
            loadError
              ? () => {
                  if (sessions.isError) void sessions.refetch();
                  if (reflection.isError) void reflection.refetch();
                }
              : undefined
          }
          retryLabel={t('reflectionReload')}
          title={t('reflectionOperationErrorTitle')}
        />
      ) : null}

      <form
        aria-busy={pending}
        className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:p-6"
        onSubmit={submit}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">{t('reflectionPrimaryTitle')}</h3>
            <p className="text-sm text-stone-500">{t('reflectionPrimaryDescription')}</p>
          </div>
          <NativeSelect
            aria-label={t('reflectionVisibilityLabel')}
            className="sm:w-44"
            onChange={(event) => {
              if (save.isError) save.reset();
              setVisibility(event.target.value === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE');
            }}
            value={visibility}
          >
            <option value="PRIVATE">{t('reflectionVisibilityPrivate')}</option>
            <option value="PUBLIC">{t('reflectionVisibilityPublic')}</option>
          </NativeSelect>
        </div>
        <Textarea
          aria-label={t('reflectionBodyLabel')}
          className="min-h-64 resize-y bg-stone-50 text-base leading-7"
          maxLength={20000}
          onChange={(event) => {
            if (save.isError) save.reset();
            setContent(event.target.value);
          }}
          placeholder={t('reflectionBodyPlaceholder')}
          value={content}
          {...testAttr('primary-reflection-content')}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1">
            <span className="text-xs text-stone-500">
              {t('reflectionCharacterLimit').replace(
                '{count}',
                normalizedContent.length.toLocaleString(),
              )}
            </span>
            <span
              aria-live="polite"
              className={
                isDirty ? 'text-xs font-medium text-warning-ink' : 'text-xs text-stone-500'
              }
              id="reflection-save-status"
              {...testAttr('reflection-save-status')}
            >
              {editorStatus}
            </span>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button
              aria-describedby="reflection-save-status"
              disabled={!savedReflectionId || startInterview.isPending || save.isPending || isDirty}
              onClick={() => {
                if (!savedReflectionId) return;
                if (workflowTarget) {
                  navigate(workflowTarget.path);
                  return;
                }
                startInterview.mutate(savedReflectionId, {
                  onSuccess: () => navigate(`/book/${bookId}/reflection/interview`),
                });
              }}
              type="button"
              variant="outline"
              {...testAttr('reflection-start-interview')}
            >
              {startInterview.isPending
                ? t('reflectionInterviewPreparing')
                : workflowTarget
                  ? workflowTarget.label
                  : t('reflectionInterviewStart')}
            </Button>
            <Button
              disabled={pending || !normalizedContent || (Boolean(savedReflectionId) && !isDirty)}
              type="submit"
              {...testAttr('primary-reflection-save')}
            >
              {save.isPending
                ? t('reflectionSavePending')
                : savedReflectionId
                  ? t('reflectionSaveRevision')
                  : t('reflectionSaveInitial')}
            </Button>
          </div>
        </div>
      </form>

      {reflection.data?.revisions.length ? (
        <section className="web-reflection-revisions rounded border border-stone-300 bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">{t('reflectionRevisionHistoryTitle')}</h3>
              <p className="text-sm text-stone-500">{t('reflectionRevisionHistoryDescription')}</p>
            </div>
            <Badge variant="outline">
              {t('reflectionRevisionCount').replace(
                '{count}',
                String(reflection.data.revisions.length),
              )}
            </Badge>
          </div>
          <ol className="mt-4 grid gap-2">
            {reflection.data.revisions.map((revision, index) => (
              <li
                className="grid gap-1 rounded border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[7rem_minmax(0,1fr)]"
                id={`reflection-revision-${revision.revisionId}`}
                key={revision.revisionId}
              >
                <span className="text-xs font-semibold text-stone-500">
                  v{revision.version} ·{' '}
                  {index === 0 ? t('reflectionGuideCurrent') : revision.revisionSource}
                </span>
                <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-6">
                  {revision.content}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </section>
  );
}
