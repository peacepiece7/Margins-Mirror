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
    ? '새 revision을 저장하고 있습니다.'
    : mode === 'ACCEPTED_SUGGESTION' && isDirty
      ? 'AI 제안을 편집기에 넣었습니다. 아직 저장되지 않았습니다.'
      : isDirty
        ? '직접 수정한 내용이 아직 저장되지 않았습니다.'
        : '현재 Reflection과 같은 내용입니다.';

  return (
    <section aria-busy={pending} className="grid gap-5" {...testAttr('reflection-refine-page')}>
      <ReflectionLoopProgress active="refine" bookId={bookId} paths={paths} />
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">REFINE / CONFIRM</p>
        <h2 className="text-2xl font-semibold tracking-tight">바꿔도, 그대로 두어도 괜찮아요</h2>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          AI 제안은 저장되지 않은 초안입니다. 최종 본문은 직접 수정하거나 선택한 뒤에만 새
          revision으로 남습니다.
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

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded border border-stone-300 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">처음 생각</h3>
            <Badge variant="outline">시작 revision</Badge>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {refinement.data?.initialContent ?? '불러오는 중…'}
          </p>
        </section>
        <section className="rounded border border-stone-300 bg-stone-50 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">토론에서 만난 관점</h3>
            <Badge variant="outline">비공개</Badge>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {refinement.data?.perspectiveSummary ?? '불러오는 중…'}
          </p>
        </section>
      </div>

      <section className="grid gap-3 rounded border border-stone-300 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">AI 수정 제안</h3>
            <p className="text-sm text-stone-500">
              현재 Reflection과 토론 관점을 비교한 초안입니다.
            </p>
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
                이전 편집 내용 되돌리기
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
              제안을 편집기에 넣기
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
            <AlertDescription>{t('reflectionRefineSuggestionFailedDescription')}</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>{t('reflectionRefineSuggestionPendingTitle')}</AlertTitle>
            <AlertDescription>{t('reflectionRefineSuggestionPendingDescription')}</AlertDescription>
          </Alert>
        )}
      </section>

      <section className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
          <div>
            <h3 className="font-semibold">내가 확정할 Reflection</h3>
            <p className="text-sm text-stone-500">직접 편집한 내용만 저장됩니다.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600" htmlFor="refinement-outcome">
              대화 뒤 변화
            </label>
            <NativeSelect
              className="mt-1"
              disabled={pending}
              id="refinement-outcome"
              onChange={(event) => setOutcome(event.target.value as RefinementOutcome)}
              value={outcome}
            >
              <option value="DEEPENED">생각이 깊어짐</option>
              <option value="NEW_PERSPECTIVE">새 관점을 만남</option>
              <option value="CHANGED">생각이 바뀜</option>
            </NativeSelect>
          </div>
        </div>
        <Textarea
          aria-label="최종 Reflection 본문"
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
          className={isDirty ? 'text-xs font-medium text-amber-800' : 'text-xs text-stone-500'}
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
            {save.isPending && save.variables?.mode === 'KEPT' ? '선택 저장 중…' : '처음 생각 유지'}
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
              ? 'revision 저장 중…'
              : '새 revision 저장'}
          </Button>
        </div>
      </section>
    </section>
  );
}
