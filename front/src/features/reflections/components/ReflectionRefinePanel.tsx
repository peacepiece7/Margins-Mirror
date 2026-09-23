import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n';
import type { RefinementMode, RefinementOutcome } from '@/types/api/reflection-loop';
import { testAttr } from '@/utils/testAttrs';

import {
  useDiscussionRunQuery,
  useReflectionRefinementQuery,
  useSaveReflectionRefinementMutation,
} from '../reflection-loop-queries';
import { reflectionErrorMessage } from '../reflection-loop-ui';
import { ReflectionOperationStatus } from './ReflectionOperationStatus';
import { ReflectionLoopProgress } from './ReflectionLoopProgress';

export function ReflectionRefinePanel({ bookId, runId }: { bookId: number; runId: number }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const run = useDiscussionRunQuery(runId);
  const refinement = useReflectionRefinementQuery(runId);
  const save = useSaveReflectionRefinementMutation(runId);
  const [draft, setDraft] = useState('');
  const [draftBeforeSuggestion, setDraftBeforeSuggestion] = useState<string | null>(null);
  const [mode, setMode] = useState<RefinementMode>('EDITED');
  const [outcome, setOutcome] = useState<RefinementOutcome>('DEEPENED');
  const persistedBaseline = useRef('');
  const currentContent = refinement.data?.currentContent ?? '';
  const suggestionStatus = refinement.data?.suggestionStatus;

  useEffect(() => {
    const previous = persistedBaseline.current;
    setDraft((current) => (current === previous ? currentContent : current));
    persistedBaseline.current = currentContent;
  }, [currentContent]);

  const paths = {
    reflect: `/book/${bookId}/reflection`,
    interview: `/book/${bookId}/reflection/interview`,
    guide: run.data ? `/book/${bookId}/reflection/guide/${run.data.guideId}` : undefined,
    discuss: `/book/${bookId}/reflection/discuss/${runId}`,
    refine: `/book/${bookId}/reflection/refine/${runId}`,
  };
  const pending = (!refinement.data && refinement.isFetching) || save.isPending;
  const isDirty = draft.trim() !== currentContent.trim();
  const operationError = run.error ?? refinement.error ?? save.error;
  const draftStatus = save.isPending
    ? t('reflectionRefineSaving')
    : mode === 'ACCEPTED_SUGGESTION' && isDirty
      ? t('reflectionRefineSuggestionApplied')
      : isDirty
        ? t('reflectionRefineDraftUnsaved')
        : t('reflectionRefineDraftUnchanged');

  return (
    <section
      aria-busy={pending}
      className="web-reflection-page web-reflection-refine grid gap-5"
      {...testAttr('reflection-refine-page')}
    >
      <ReflectionLoopProgress active="refine" bookId={bookId} paths={paths} />
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">REFINE / CONFIRM</p>
        <h2 className="text-2xl font-semibold tracking-tight">{t('reflectionRefineTitle')}</h2>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          {t('reflectionRefineDescription')}
        </p>
      </header>

      {operationError ? (
        <ReflectionOperationStatus
          message={reflectionErrorMessage(
            operationError,
            t('reflectionRefineOperationErrorDescription'),
          )}
          onRetry={refinement.isError ? () => void refinement.refetch() : undefined}
          retryLabel={t('reflectionReload')}
          title={t('reflectionRefineOperationErrorTitle')}
        />
      ) : null}

      <div className="web-refine-comparison grid gap-3 lg:grid-cols-3">
        <section className="rounded border border-stone-300 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{t('reflectionRefineInitialTitle')}</h3>
            <Badge variant="outline">{t('reflectionRefineInitialBadge')}</Badge>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {refinement.data?.initialContent ?? t('reflectionRefineLoading')}
          </p>
        </section>
        <section className="rounded border border-stone-300 bg-stone-50 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{t('reflectionRefinePerspectiveTitle')}</h3>
            <Badge variant="outline">{t('reflectionRefinePrivate')}</Badge>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {refinement.data?.perspectiveSummary ?? t('reflectionRefineLoading')}
          </p>
        </section>
        <section className="grid gap-3 rounded border border-stone-300 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">{t('reflectionRefineSuggestionTitle')}</h3>
              <p className="text-sm text-stone-500">{t('reflectionRefineSuggestionDescription')}</p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {draftBeforeSuggestion !== null ? (
                <Button
                  disabled={pending}
                  onClick={() => {
                    setDraft(draftBeforeSuggestion);
                    setDraftBeforeSuggestion(null);
                    setMode('EDITED');
                  }}
                  type="button"
                  variant="ghost"
                >
                  {t('reflectionRefineUndoSuggestion')}
                </Button>
              ) : null}
              <Button
                disabled={pending || !refinement.data?.suggestedContent}
                onClick={() => {
                  const suggestion = refinement.data?.suggestedContent ?? '';
                  if (draft !== suggestion) {
                    setDraftBeforeSuggestion(draft);
                  }
                  setDraft(suggestion);
                  setMode('ACCEPTED_SUGGESTION');
                }}
                type="button"
                variant="outline"
              >
                {t('reflectionRefineUseSuggestion')}
              </Button>
            </div>
          </div>
          {suggestionStatus === 'READY' && refinement.data?.suggestedContent ? (
            <p className="rounded bg-stone-50 p-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
              {refinement.data.suggestedContent}
            </p>
          ) : suggestionStatus === 'FAILED' ? (
            <Alert>
              <AlertTitle>{t('reflectionRefineSuggestionFailedTitle')}</AlertTitle>
              <AlertDescription>
                {t('reflectionRefineSuggestionFailedDescription')}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>{t('reflectionRefineSuggestionPendingTitle')}</AlertTitle>
              <AlertDescription>
                {t('reflectionRefineSuggestionPendingDescription')}
              </AlertDescription>
            </Alert>
          )}
        </section>
      </div>

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
              disabled={pending}
              id="refinement-outcome"
              onChange={(event) => setOutcome(event.target.value as RefinementOutcome)}
              value={outcome}
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
          disabled={pending}
          maxLength={20000}
          onChange={(event) => {
            if (save.isError) save.reset();
            setDraft(event.target.value);
            setMode('EDITED');
          }}
          value={draft}
          {...testAttr('refined-reflection-content')}
        />
        <p
          aria-live="polite"
          className={isDirty ? 'text-xs font-medium text-warning-ink' : 'text-xs text-stone-500'}
          id="refinement-draft-status"
          {...testAttr('refinement-draft-status')}
        >
          {draftStatus}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            aria-describedby="refinement-draft-status"
            disabled={pending}
            onClick={() =>
              save.mutate(
                { mode: 'KEPT', outcome: 'KEPT' },
                { onSuccess: () => navigate(`/book/${bookId}/reflection`) },
              )
            }
            type="button"
            variant="outline"
            {...testAttr('reflection-keep-original')}
          >
            {save.isPending && save.variables?.mode === 'KEPT'
              ? t('reflectionRefineKeepPending')
              : t('reflectionRefineKeepOriginal')}
          </Button>
          <Button
            disabled={pending || !draft.trim() || !isDirty}
            onClick={() =>
              save.mutate(
                { mode, outcome, finalContent: draft.trim() },
                { onSuccess: () => navigate(`/book/${bookId}/reflection`) },
              )
            }
            type="button"
            {...testAttr('reflection-save-refinement')}
          >
            {save.isPending && save.variables?.mode !== 'KEPT'
              ? t('reflectionRefineSavePending')
              : t('reflectionRefineSaveRevision')}
          </Button>
        </div>
      </section>
    </section>
  );
}
