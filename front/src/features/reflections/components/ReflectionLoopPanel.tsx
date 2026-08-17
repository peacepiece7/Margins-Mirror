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

import { useEnsureReflectionSessionMutation, useReflectionSessionForBook } from '../queries';
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
  const ensureSession = useEnsureReflectionSessionMutation(bookId);
  const ensureSessionPending = ensureSession.isPending;
  const ensureSessionMutation = ensureSession.mutate;
  const save = useSavePrimaryReflectionMutation(sessionId, reflection.data?.reflectionId);
  const startInterview = useStartReflectionInterviewMutation();
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<ReflectionVisibility>('PRIVATE');
  const persistedBaseline = useRef<{
    content: string;
    visibility: ReflectionVisibility;
  }>({ content: '', visibility: 'PRIVATE' });

  useEffect(() => {
    if (!sessions.isLoading && !sessionId && !ensureSessionPending) {
      ensureSessionMutation(undefined);
    }
  }, [ensureSessionMutation, ensureSessionPending, sessionId, sessions.isLoading]);

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
        label: runCompleted ? 'Reflection 다듬기' : '토론 이어가기',
        path: `/book/${bookId}/reflection/${runCompleted ? 'refine' : 'discuss'}/${runId}`,
      }
    : guideId
      ? {
          label: '현재 발제안 보기',
          path: `/book/${bookId}/reflection/guide/${guideId}`,
        }
      : interviewId
        ? {
            label: '인터뷰 이어가기',
            path: `/book/${bookId}/reflection/interview`,
          }
        : null;
  const normalizedContent = content.trim();
  const isDirty =
    normalizedContent !== persistedContent.trim() || visibility !== persistedVisibility;
  const pending =
    sessions.isLoading ||
    reflection.isFetching ||
    ensureSession.isPending ||
    save.isPending ||
    startInterview.isPending;
  const missingReflection =
    reflection.error instanceof ApiRequestError && reflection.error.status === 404;
  const loadError = sessions.error ?? (missingReflection ? null : reflection.error);
  const operationError = loadError ?? save.error ?? startInterview.error ?? ensureSession.error;
  const editorStatus = save.isPending
    ? '변경 사항을 저장하고 있습니다.'
    : isDirty
      ? '저장되지 않은 변경 사항이 있습니다. 인터뷰 전에 먼저 저장해 주세요.'
      : savedReflectionId
        ? '모든 변경 사항이 저장되었습니다.'
        : '첫 생각을 적고 저장해 주세요.';

  return (
    <section className="grid gap-5" {...testAttr('reflection-loop-page')}>
      <ReflectionLoopProgress active="reflect" bookId={bookId} />
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">REFLECT / MVP2</p>
        <h2 className="text-2xl font-semibold tracking-tight">지금의 생각을 먼저 남겨보세요</h2>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          완성된 리뷰일 필요는 없습니다. 짧고 미완성인 생각도 저장한 뒤 질문과 토론을 거치며 직접
          다듬을 수 있습니다.
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
        <Alert className="border-amber-300 bg-amber-50" role="status">
          <AlertTitle>Reflection을 아직 작성하지 않았어</AlertTitle>
          <AlertDescription>
            {reflection.error instanceof ApiRequestError
              ? reflection.error.message
              : '지금의 생각을 먼저 적어 저장해줘.'}
          </AlertDescription>
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
            <h3 className="font-semibold">Primary Reflection</h3>
            <p className="text-sm text-stone-500">reading session마다 하나의 기록을 이어갑니다.</p>
          </div>
          <NativeSelect
            aria-label="현재 Reflection 공개 범위"
            className="sm:w-44"
            onChange={(event) => {
              if (save.isError) save.reset();
              setVisibility(event.target.value === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE');
            }}
            value={visibility}
          >
            <option value="PRIVATE">나만 보기</option>
            <option value="PUBLIC">현재 글 공개</option>
          </NativeSelect>
        </div>
        <Textarea
          aria-label="Reflection 본문"
          className="min-h-64 resize-y bg-stone-50 text-base leading-7"
          maxLength={20000}
          onChange={(event) => {
            if (save.isError) save.reset();
            setContent(event.target.value);
          }}
          placeholder="이 책을 읽고 지금 가장 남은 생각은 무엇인가요?"
          value={content}
          {...testAttr('primary-reflection-content')}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1">
            <span className="text-xs text-stone-500">
              {normalizedContent.length.toLocaleString()} / 20,000자
            </span>
            <span
              aria-live="polite"
              className={isDirty ? 'text-xs font-medium text-amber-800' : 'text-xs text-stone-500'}
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
                ? '인터뷰 준비 중…'
                : workflowTarget
                  ? workflowTarget.label
                  : '인터뷰 시작'}
            </Button>
            <Button
              disabled={pending || !normalizedContent || (Boolean(savedReflectionId) && !isDirty)}
              type="submit"
              {...testAttr('primary-reflection-save')}
            >
              {save.isPending ? '저장 중…' : savedReflectionId ? '새 revision 저장' : '생각 저장'}
            </Button>
          </div>
        </div>
      </form>

      {reflection.data?.revisions.length ? (
        <section className="rounded border border-stone-300 bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Revision history</h3>
              <p className="text-sm text-stone-500">이력은 나에게만 보이며 수정되지 않습니다.</p>
            </div>
            <Badge variant="outline">{reflection.data.revisions.length}개</Badge>
          </div>
          <ol className="mt-4 grid gap-2">
            {reflection.data.revisions.map((revision, index) => (
              <li
                className="grid gap-1 rounded border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[7rem_minmax(0,1fr)]"
                id={`reflection-revision-${revision.revisionId}`}
                key={revision.revisionId}
              >
                <span className="text-xs font-semibold text-stone-500">
                  v{revision.version} · {index === 0 ? '현재' : revision.revisionSource}
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
