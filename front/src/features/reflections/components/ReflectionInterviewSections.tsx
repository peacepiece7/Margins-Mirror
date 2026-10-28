import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n';
import type { InterviewAnswer, InterviewAnswerRevisionKind } from '@/types/api/reflection-loop';
import { testAttr } from '@/utils/testAttrs';

import type { ReflectionInterview } from '../use-reflection-interview';
import type { InterviewAnswerDraft } from '../panel-types';
import { DeveloperDraftControl } from './DeveloperDraftControl';
import { GuideBriefFields } from './GuideBriefFields';
import { SourceFreshnessBadges } from './SourceFreshnessBadges';

export function InterviewFeedback({
  operationError,
  onRetryStart,
  onReload,
  guideError,
  guideRequestId,
  creatingGuide,
  onRetryGuide,
}: ReflectionInterview['feedback']) {
  const { t } = useI18n();
  return (
    <>
      {operationError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('reflectionInterviewOperationErrorTitle')}</AlertTitle>
          <AlertDescription>{t('reflectionInterviewOperationErrorDescription')}</AlertDescription>
          {onRetryStart ? (
            <Button className="mt-3" onClick={onRetryStart} type="button" variant="outline">
              {t('reflectionInterviewOpen')}
            </Button>
          ) : null}
          {onReload ? (
            <Button className="mt-3" onClick={onReload} type="button" variant="outline">
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
            disabled={creatingGuide}
            onClick={onRetryGuide}
            type="button"
            variant="outline"
          >
            {creatingGuide
              ? t('reflectionInterviewGuideCreating')
              : t('reflectionInterviewGuideRetry')}
          </Button>
        </Alert>
      ) : null}
    </>
  );
}

export function InterviewAnswerProgress({ data, progress }: ReflectionInterview['summary']) {
  const { t } = useI18n();
  return (
    <section className="rounded border border-stone-300 bg-white p-4 sm:p-6">
      <div aria-live="polite" className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-stone-500">ANSWER PROGRESS</span>
          <p className="mt-1 text-3xl font-semibold">
            {data?.answeredCount ?? 0}
            <span className="ml-1 text-base font-normal text-stone-500">
              /{' '}
              {t('reflectionInterviewTarget').replace('{count}', String(data?.targetAnswers ?? 5))}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {t('reflectionInterviewMinimum').replace('{count}', String(data?.minimumAnswers ?? 3))}
          </Badge>
          <Badge variant="outline">
            {t('reflectionInterviewGenerated').replace(
              '{count}',
              String(data?.generatedCount ?? 0),
            )}
          </Badge>
          <Badge variant="outline">
            {t('reflectionInterviewSkipped').replace('{count}', String(data?.skippedCount ?? 0))}
          </Badge>
        </div>
      </div>
      <div
        aria-label={t('reflectionInterviewProgressAria').replace('{progress}', String(progress))}
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
  );
}

export function InterviewHistory({ answers, pending, onSave }: ReflectionInterview['history']) {
  const { t } = useI18n();
  const [editingAnswer, setEditingAnswer] = useState<InterviewAnswerDraft>();
  function saveAnswerRevision(
    savedAnswer: InterviewAnswer,
    revisionKind: InterviewAnswerRevisionKind,
  ) {
    if (!editingAnswer) return;
    onSave(savedAnswer, revisionKind, editingAnswer.content, () => setEditingAnswer(undefined));
  }
  if (!answers.length) return null;
  return (
    <section className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-stone-500">ANSWER HISTORY</p>
        <h3 className="mt-1 text-lg font-semibold">{t('reflectionInterviewHistoryTitle')}</h3>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {t('reflectionInterviewHistoryDescription')}
        </p>
      </div>
      <ol className="grid gap-3">
        {answers.map((savedAnswer) => {
          const editing = editingAnswer?.questionId === savedAnswer.questionId;
          return (
            <li
              className="grid gap-3 rounded border border-stone-200 bg-stone-50 p-4"
              key={savedAnswer.answerRevisionId}
            >
              <div>
                <p className="text-xs font-semibold text-stone-500">
                  {t('reflectionInterviewQuestionLabel')}
                </p>
                <p className="mt-1 text-sm font-medium leading-6">{savedAnswer.question}</p>
              </div>
              {editing ? (
                <Textarea
                  aria-label={t('reflectionInterviewEditAnswerLabel').replace(
                    '{question}',
                    savedAnswer.question,
                  )}
                  className="min-h-32 resize-y bg-white leading-7"
                  disabled={pending}
                  maxLength={12000}
                  onChange={(event) =>
                    setEditingAnswer({
                      questionId: savedAnswer.questionId,
                      content: event.target.value,
                    })
                  }
                  value={editingAnswer?.content ?? ''}
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
                      disabled={pending || !editingAnswer?.content.trim()}
                      onClick={() => saveAnswerRevision(savedAnswer, 'WORDING_ONLY')}
                      type="button"
                    >
                      {t('reflectionInterviewEditWording')}
                    </Button>
                    <Button
                      disabled={pending || !editingAnswer?.content.trim()}
                      onClick={() => saveAnswerRevision(savedAnswer, 'RESTART_FROM_HERE')}
                      type="button"
                      variant="outline"
                    >
                      {t('reflectionInterviewRestartHere')}
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => setEditingAnswer(undefined)}
                      type="button"
                      variant="ghost"
                    >
                      {t('cancel')}
                    </Button>
                  </>
                ) : (
                  <Button
                    aria-label={t('reflectionInterviewEditAnswerLabel').replace(
                      '{question}',
                      savedAnswer.question,
                    )}
                    disabled={pending}
                    onClick={() =>
                      setEditingAnswer({
                        questionId: savedAnswer.questionId,
                        content: savedAnswer.content,
                      })
                    }
                    type="button"
                    variant="outline"
                  >
                    {t('reflectionInterviewEditAnswer')}
                  </Button>
                )}
                <span className="text-xs text-stone-500">
                  {t('reflectionInterviewAnswerVersion').replace(
                    '{version}',
                    String(savedAnswer.version),
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function InterviewCurrentQuestion({
  bookId,
  interviewId,
  data,
  question,
  pending,
  answerRef,
  onSend,
  pendingMode,
  continuing,
  onContinue,
}: ReflectionInterview['question']) {
  const { t } = useI18n();
  const [answer, setAnswer] = useState('');
  if (!question) {
    return (
      <section className="rounded border border-stone-300 bg-white p-6">
        <h3 className="font-semibold">
          {data?.maxReached
            ? t('reflectionInterviewQuestionsComplete')
            : t('reflectionInterviewQuestionPreparing')}
        </h3>
        <p className="mt-2 text-sm text-stone-600">
          {data?.canGenerateGuide
            ? t('reflectionInterviewGuideReady')
            : t('reflectionInterviewGuideNeedsAnswers')}
        </p>
        {data && !data.maxReached && !data.guideId ? (
          <Button
            className="mt-4"
            disabled={pending}
            onClick={onContinue}
            type="button"
            variant="outline"
            {...testAttr('reflection-continue-interview')}
          >
            {continuing
              ? t('reflectionInterviewContinuePending')
              : data.canGenerateGuide
                ? t('reflectionInterviewContinueMore')
                : t('reflectionInterviewContinueRetry')}
          </Button>
        ) : null}
      </section>
    );
  }
  return (
    <section
      className="grid gap-5 rounded border border-stone-300 bg-white p-4 sm:p-6"
      data-ui="reflection-interview-question"
      {...testAttr('reflection-interview-question')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{question.coverageArea.replaceAll('_', ' ')}</Badge>
        <Badge variant="outline">
          {t('reflectionSensitivity')} {question.sensitivity}
        </Badge>
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
            {t('reflectionInterviewEvidence')}: {question.sourceExcerpt}
          </p>
          <a
            className="mt-1 inline-flex min-h-11 items-center font-medium text-stone-900 underline underline-offset-4"
            href={`/book/${bookId}/reflection#reflection-revision-${data?.sourceRevisionId}`}
          >
            {t('reflectionInterviewViewSource')}
          </a>
        </div>
      </div>
      <Textarea
        aria-label={t('reflectionInterviewAnswerLabel')}
        className="min-h-40 resize-y bg-stone-50 leading-7"
        disabled={pending}
        maxLength={12000}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder={t('reflectionInterviewAnswerPlaceholder')}
        ref={answerRef}
        value={answer}
        {...testAttr('reflection-interview-answer')}
      />
      <DeveloperDraftControl
        bookId={bookId}
        draftKey={`${interviewId}:${question.questionId}`}
        context={[question.sourceExcerpt, answer].filter(Boolean).join('\n\n')}
        disabled={pending}
        onGenerated={setAnswer}
        subject={question.question}
        target="INTERVIEW_ANSWER"
      />
      <div className="flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            disabled={pending}
            onClick={() => onSend('BOOK_ONLY', answer)}
            type="button"
            variant="outline"
          >
            {pendingMode === 'BOOK_ONLY'
              ? t('reflectionInterviewBookOnlyPending')
              : t('reflectionInterviewBookOnly')}
          </Button>
          <Button
            disabled={pending}
            onClick={() => onSend('SKIP', answer)}
            type="button"
            variant="ghost"
          >
            {pendingMode === 'SKIP'
              ? t('reflectionInterviewSkipPending')
              : t('reflectionInterviewSkip')}
          </Button>
        </div>
        <Button
          disabled={pending || !answer.trim()}
          onClick={() => onSend('ANSWER', answer)}
          type="button"
        >
          {pendingMode === 'ANSWER'
            ? t('reflectionInterviewAnswerPending')
            : t('reflectionInterviewAnswerNext')}
        </Button>
      </div>
    </section>
  );
}

export function InterviewGuideActions({
  data,
  pending,
  creating,
  brief,
  onBriefChange,
  onCreateOrView,
}: ReflectionInterview['guide']) {
  const { t } = useI18n();
  return (
    <>
      {data?.canGenerateGuide && !data.guideId ? (
        <section
          className="grid gap-4 rounded border border-stone-300 bg-stone-50 p-4 sm:p-6"
          {...testAttr('discussion-guide-brief')}
        >
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-stone-500">GUIDE BRIEF</p>
            <h3 className="mt-1 text-lg font-semibold">{t('reflectionInterviewBriefTitle')}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              {t('reflectionInterviewBriefDescription')}
            </p>
          </div>
          <GuideBriefFields disabled={pending} onChange={onBriefChange} value={brief} />
        </section>
      ) : null}
      <div className="sticky bottom-2 flex justify-end rounded border border-stone-300 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-3">
        <Button
          className="min-h-11 w-full px-5 sm:w-auto"
          disabled={!data?.canGenerateGuide || pending}
          onClick={onCreateOrView}
          type="button"
          variant="default"
          {...testAttr('reflection-create-guide')}
        >
          {creating
            ? t('reflectionInterviewGuideCreating')
            : data?.guideId
              ? t('reflectionInterviewGuideView')
              : t('reflectionInterviewGuideCreate')}
        </Button>
      </div>
    </>
  );
}
