import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { Textarea } from '@/components/ui/textarea';
import type {
  GuideBriefInput,
  InterviewAnswer,
  InterviewAnswerRevisionKind,
} from '@/types/api/reflection-loop';
import { testAttr } from '@/utils/testAttrs';

import { useReflectionTimelineForBook } from '../queries';
import {
  useCreateDiscussionGuideMutation,
  useContinueReflectionInterviewMutation,
  useInterviewResponseMutation,
  useUpdateInterviewAnswerMutation,
  useReflectionInterviewQuery,
  useReflectionLoopQuery,
  useStartReflectionInterviewMutation,
} from '../reflection-loop-queries';
import { findPrimaryReflection } from '../reflection-loop-state';
import { reflectionErrorMessage, reflectionRequestId } from '../reflection-loop-ui';
import { GuideBriefFields } from './GuideBriefFields';
import { ReflectionLoopProgress } from './ReflectionLoopProgress';
import { SourceFreshnessBadges } from './SourceFreshnessBadges';

const defaultGuideBrief: GuideBriefInput = {
  purpose: 'THOUGHT_EXPANSION',
  audienceMode: 'SMALL_GROUP',
  targetMinutes: 20,
  disclosureMode: 'PRIVATE_CONTEXT',
  facilitationLevel: 'BEGINNER',
};

export function ReflectionInterviewPanel({ bookId }: { bookId: number }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { timeline } = useReflectionTimelineForBook(bookId);
  const reflectionId = findPrimaryReflection(timeline.data?.insights)?.insightId;
  const reflection = useReflectionLoopQuery(reflectionId);
  const start = useStartReflectionInterviewMutation();
  const startPending = start.isPending;
  const startMutation = start.mutate;
  const interviewId = reflection.data?.activeInterviewId;
  const interview = useReflectionInterviewQuery(interviewId ?? undefined);
  const respond = useInterviewResponseMutation(interviewId ?? 0);
  const updateAnswer = useUpdateInterviewAnswerMutation(interviewId ?? 0);
  const createGuide = useCreateDiscussionGuideMutation(interviewId ?? 0);
  const continueInterview = useContinueReflectionInterviewMutation(interviewId ?? 0);
  const [answer, setAnswer] = useState('');
  const [guideBrief, setGuideBrief] = useState<GuideBriefInput>(defaultGuideBrief);
  const [editingAnswerQuestionId, setEditingAnswerQuestionId] = useState<number | null>(null);
  const [editingAnswer, setEditingAnswer] = useState('');
  const answerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (reflectionId && reflection.isSuccess && !interviewId && !startPending && !start.isError) {
      startMutation(reflectionId);
    }
  }, [interviewId, reflection.isSuccess, reflectionId, start.isError, startMutation, startPending]);

  const currentQuestionId = interview.data?.currentQuestion?.questionId;
  useEffect(() => {
    setAnswer('');
  }, [currentQuestionId]);

  useEffect(() => {
    setEditingAnswerQuestionId(null);
    setEditingAnswer('');
  }, [interviewId]);

  if (!timeline.isFetching && !reflectionId) {
    return (
      <section className="grid gap-4">
        <ReflectionLoopProgress active="interview" bookId={bookId} />
        <div className="rounded border border-stone-300 bg-white p-6">
          <h2 className="text-xl font-semibold">{t('reflectionInterviewMissingTitle')}</h2>
          <Button
            className="mt-4"
            onClick={() => navigate(`/book/${bookId}/reflection`)}
            type="button"
          >
            {t('reflectionInterviewMissingAction')}
          </Button>
        </div>
      </section>
    );
  }

  const data = interview.data;
  const question = data?.currentQuestion;
  const progress = data
    ? Math.min(100, Math.round((data.answeredCount / data.targetAnswers) * 100))
    : 0;
  const pending =
    respond.isPending ||
    updateAnswer.isPending ||
    createGuide.isPending ||
    continueInterview.isPending ||
    interview.isFetching ||
    start.isPending;
  const operationError =
    timeline.error ??
    reflection.error ??
    start.error ??
    interview.error ??
    respond.error ??
    updateAnswer.error ??
    continueInterview.error;
  const guideError = createGuide.error;
  const guideRequestId = reflectionRequestId(guideError);
  const paths = {
    reflect: `/book/${bookId}/reflection`,
    interview: `/book/${bookId}/reflection/interview`,
  };

  function send(mode: 'ANSWER' | 'BOOK_ONLY' | 'SKIP') {
    if (!data || !question || respond.isPending) return;
    if (mode === 'ANSWER' && !answer.trim()) return;
    respond.mutate(
      {
        questionId: question.questionId,
        mode,
        content: mode === 'ANSWER' ? answer.trim() : undefined,
      },
      {
        onSuccess: () => {
          requestAnimationFrame(() => answerRef.current?.focus());
        },
      },
    );
  }

  function createDiscussionGuide() {
    if (!data || data.guideId || createGuide.isPending) return;
    createGuide.mutate(guideBrief, {
      onSuccess: (guide) => navigate(`/book/${bookId}/reflection/guide/${guide.guideId}`),
    });
  }

  function beginAnswerEdit(savedAnswer: InterviewAnswer) {
    setEditingAnswerQuestionId(savedAnswer.questionId);
    setEditingAnswer(savedAnswer.content);
  }

  function cancelAnswerEdit() {
    setEditingAnswerQuestionId(null);
    setEditingAnswer('');
  }

  function saveAnswerRevision(
    savedAnswer: InterviewAnswer,
    revisionKind: InterviewAnswerRevisionKind,
  ) {
    if (!editingAnswer.trim() || updateAnswer.isPending) return;
    updateAnswer.mutate(
      {
        questionId: savedAnswer.questionId,
        expectedAnswerVersion: savedAnswer.version,
        content: editingAnswer.trim(),
        revisionKind,
      },
      { onSuccess: cancelAnswerEdit },
    );
  }

  return (
    <section aria-busy={pending} className="grid gap-5" {...testAttr('reflection-interview-page')}>
      <ReflectionLoopProgress active="interview" bookId={bookId} paths={paths} />
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">ADAPTIVE INTERVIEW</p>
        <h2 className="text-2xl font-semibold tracking-tight">한 번에 한 질문씩 생각을 넓혀요</h2>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          최소 3개 답변부터 발제안을 만들 수 있고, 5개를 권장하며 질문은 최대 7개까지 이어집니다.
        </p>
      </header>

      {operationError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('reflectionInterviewOperationErrorTitle')}</AlertTitle>
          <AlertDescription>
            {reflectionErrorMessage(
              operationError,
              t('reflectionInterviewOperationErrorDescription'),
            )}
          </AlertDescription>
          {start.isError && reflectionId ? (
            <Button
              className="mt-3"
              onClick={() => {
                start.reset();
                start.mutate(reflectionId);
              }}
              type="button"
              variant="outline"
            >
              {t('reflectionInterviewOpen')}
            </Button>
          ) : null}
          {timeline.isError || reflection.isError || interview.isError ? (
            <Button
              className="mt-3"
              onClick={() => {
                if (timeline.isError) void timeline.refetch();
                if (reflection.isError) void reflection.refetch();
                if (interview.isError) void interview.refetch();
              }}
              type="button"
              variant="outline"
            >
              {t('reflectionInterviewReload')}
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {guideError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('reflectionInterviewGuideErrorTitle')}</AlertTitle>
          <AlertDescription className="grid gap-1">
            <span>{t('reflectionInterviewGuideErrorDescription')}</span>
            {guideRequestId ? (
              <span className="text-xs opacity-80">
                {t('reflectionInterviewGuideRequestId').replace('{id}', guideRequestId)}
              </span>
            ) : null}
          </AlertDescription>
          <Button
            className="mt-3"
            disabled={createGuide.isPending}
            onClick={() => {
              createGuide.reset();
              createDiscussionGuide();
            }}
            type="button"
            variant="outline"
          >
            {createGuide.isPending
              ? t('reflectionInterviewGuideCreating')
              : t('reflectionInterviewGuideRetry')}
          </Button>
        </Alert>
      ) : null}

      <section className="rounded border border-stone-300 bg-white p-4 sm:p-6">
        <div aria-live="polite" className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-stone-500">ANSWER PROGRESS</span>
            <p className="mt-1 text-3xl font-semibold">
              {data?.answeredCount ?? 0}
              <span className="ml-1 text-base font-normal text-stone-500">
                / 목표 {data?.targetAnswers ?? 5}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">최소 {data?.minimumAnswers ?? 3}</Badge>
            <Badge variant="outline">생성 {data?.generatedCount ?? 0}/7</Badge>
            <Badge variant="outline">건너뜀 {data?.skippedCount ?? 0}</Badge>
          </div>
        </div>
        <div
          aria-label={`답변 목표 진행률 ${progress}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-stone-950 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      {data?.answers?.length ? (
        <section className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:p-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-stone-500">ANSWER HISTORY</p>
            <h3 className="mt-1 text-lg font-semibold">이전 답변을 다듬을 수 있어요</h3>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              표현만 고치면 같은 인터뷰 흐름에 반영하고, 생각이 달라졌다면 해당 지점부터 새 질문
              흐름을 시작합니다. 기존 발제안과 토론 기록은 그대로 보존됩니다.
            </p>
          </div>
          <ol className="grid gap-3">
            {data.answers.map((savedAnswer) => {
              const editing = editingAnswerQuestionId === savedAnswer.questionId;
              return (
                <li
                  className="grid gap-3 rounded border border-stone-200 bg-stone-50 p-4"
                  key={savedAnswer.answerRevisionId}
                >
                  <div>
                    <p className="text-xs font-semibold text-stone-500">질문</p>
                    <p className="mt-1 text-sm font-medium leading-6">{savedAnswer.question}</p>
                  </div>
                  {editing ? (
                    <Textarea
                      aria-label={`${savedAnswer.question} 답변 수정`}
                      className="min-h-32 resize-y bg-white leading-7"
                      disabled={pending}
                      maxLength={12000}
                      onChange={(event) => setEditingAnswer(event.target.value)}
                      value={editingAnswer}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
                      {savedAnswer.content}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {editing ? (
                      <>
                        <Button
                          disabled={pending || !editingAnswer.trim()}
                          onClick={() => saveAnswerRevision(savedAnswer, 'WORDING_ONLY')}
                          type="button"
                        >
                          표현만 다듬기
                        </Button>
                        <Button
                          disabled={pending || !editingAnswer.trim()}
                          onClick={() => saveAnswerRevision(savedAnswer, 'RESTART_FROM_HERE')}
                          type="button"
                          variant="outline"
                        >
                          여기서 다시 답하기
                        </Button>
                        <Button
                          disabled={pending}
                          onClick={cancelAnswerEdit}
                          type="button"
                          variant="ghost"
                        >
                          취소
                        </Button>
                      </>
                    ) : (
                      <Button
                        aria-label={`${savedAnswer.question} 답변 수정`}
                        disabled={pending}
                        onClick={() => beginAnswerEdit(savedAnswer)}
                        type="button"
                        variant="outline"
                      >
                        답변 수정
                      </Button>
                    )}
                    <span className="text-xs text-stone-500">version {savedAnswer.version}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {question ? (
        <section
          className="grid gap-5 rounded border border-stone-300 bg-white p-4 sm:p-6"
          {...testAttr('reflection-interview-question')}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{question.coverageArea.replaceAll('_', ' ')}</Badge>
            <Badge variant="outline">민감도 {question.sensitivity}</Badge>
            <Badge variant="outline">{question.sourceType}</Badge>
            <SourceFreshnessBadges
              fallback={question.sourceFallback}
              stale={question.sourceStale}
              version={question.sourceVersion}
            />
          </div>
          <div>
            <h3 className="text-xl font-semibold leading-8">{question.question}</h3>
            <div className="mt-3 border-l-2 border-stone-300 pl-3 text-sm leading-6 text-stone-500">
              <p className="line-clamp-3 break-words" title={question.sourceExcerpt}>
                근거: {question.sourceExcerpt}
              </p>
              <a
                className="mt-1 inline-flex min-h-11 items-center font-medium text-stone-900 underline underline-offset-4"
                href={`/book/${bookId}/reflection#reflection-revision-${data.sourceRevisionId}`}
              >
                원문 revision 보기
              </a>
            </div>
          </div>
          <Textarea
            aria-label="인터뷰 답변"
            className="min-h-40 resize-y bg-stone-50 leading-7"
            disabled={pending}
            maxLength={12000}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="완성된 문장이 아니어도 괜찮아요. 지금 떠오르는 근거나 질문부터 적어보세요."
            ref={answerRef}
            value={answer}
            {...testAttr('reflection-interview-answer')}
          />
          <div className="flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button
                disabled={pending}
                onClick={() => send('BOOK_ONLY')}
                type="button"
                variant="outline"
              >
                {respond.isPending && respond.variables?.mode === 'BOOK_ONLY'
                  ? '질문 바꾸는 중…'
                  : '책 이야기만 하기'}
              </Button>
              <Button disabled={pending} onClick={() => send('SKIP')} type="button" variant="ghost">
                {respond.isPending && respond.variables?.mode === 'SKIP'
                  ? '건너뛰는 중…'
                  : '건너뛰기'}
              </Button>
            </div>
            <Button
              disabled={pending || !answer.trim()}
              onClick={() => send('ANSWER')}
              type="button"
            >
              {respond.isPending && respond.variables?.mode === 'ANSWER'
                ? '답변 저장 중…'
                : '답변 저장하고 다음'}
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded border border-stone-300 bg-white p-6">
          <h3 className="font-semibold">
            {data?.maxReached ? '질문을 모두 살펴봤어요' : '다음 질문을 준비하고 있어요'}
          </h3>
          <p className="mt-2 text-sm text-stone-600">
            {data?.canGenerateGuide
              ? '지금까지의 답변으로 발제안을 만들 수 있습니다.'
              : '발제안을 만들려면 답변 3개가 필요합니다.'}
          </p>
          {data && !data.maxReached && !data.guideId ? (
            <Button
              className="mt-4"
              disabled={pending}
              onClick={() => continueInterview.mutate()}
              type="button"
              variant="outline"
              {...testAttr('reflection-continue-interview')}
            >
              {continueInterview.isPending
                ? '질문 준비 중…'
                : data.canGenerateGuide
                  ? '질문 더 이어가기'
                  : '다음 질문 다시 준비하기'}
            </Button>
          ) : null}
        </section>
      )}

      {data?.canGenerateGuide && !data.guideId ? (
        <section
          className="grid gap-4 rounded border border-stone-300 bg-stone-50 p-4 sm:p-6"
          {...testAttr('discussion-guide-brief')}
        >
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-stone-500">GUIDE BRIEF</p>
            <h3 className="mt-1 text-lg font-semibold">어떤 대화를 준비할까요?</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              이 설정은 발제안 version에 함께 저장됩니다. 비공개 답변을 참고하더라도 답변 원문은
              발제안에 표시되지 않습니다. 모든 참여 형태는 AI가 진행을 돕고, 소그룹은 여러 사람이
              함께 답하는 형식만 뜻합니다.
            </p>
          </div>
          <GuideBriefFields disabled={pending} onChange={setGuideBrief} value={guideBrief} />
        </section>
      ) : null}

      <div className="sticky bottom-2 flex justify-end rounded border border-stone-300 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-3">
        <Button
          className="min-h-11 w-full px-5 sm:w-auto"
          disabled={!data?.canGenerateGuide || pending}
          onClick={() => {
            if (!data) return;
            if (data.guideId) {
              navigate(`/book/${bookId}/reflection/guide/${data.guideId}`);
              return;
            }
            createDiscussionGuide();
          }}
          type="button"
          variant="default"
          {...testAttr('reflection-create-guide')}
        >
          {createGuide.isPending
            ? '발제안 만드는 중…'
            : data?.guideId
              ? '발제안 보기'
              : '발제안 만들기'}
        </Button>
      </div>
    </section>
  );
}
