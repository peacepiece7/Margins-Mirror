import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Skeleton } from '@/components/ui/legacy-skeleton';
import {
  QUESTION_AI_NOTICE_DISMISS_DAYS,
  QUESTION_AI_NOTICE_COOKIE_KEY,
} from '@/lib/dismissible-notice';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import { AiProcessingNotice } from '@/components/ui/ai-processing-notice';

import {
  useDeleteQuestionMutation,
  useGenerateQuestionsForBookMutation,
  useReflectionTimelineForBook,
} from '../queries';

export function QuestionPanel({ bookId }: { bookId: number }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { sessionId, timeline } = useReflectionTimelineForBook(bookId);
  const generate = useGenerateQuestionsForBookMutation(bookId);
  const deleteQuestion = useDeleteQuestionMutation(sessionId);
  const [pendingDeleteQuestionId, setPendingDeleteQuestionId] = useState<number>();
  const questions = timeline.data?.questions ?? [];
  const answeredQuestionIds = new Set([
    ...(timeline.data?.messages ?? [])
      .filter((message) => message.role === 'user' && message.questionId)
      .map((message) => message.questionId as number),
    ...(timeline.data?.insights ?? [])
      .filter((insight) => insight.insightType === 'question_answer' && insight.questionId)
      .map((insight) => insight.questionId as number),
  ]);

  return (
    <>
      <div
        className="rounded border border-stone-300 bg-white p-4 sm:p-5"
        data-ui="book-question-panel"
        {...testAttr('book-question-panel')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">{t('questionPanelTitle')}</h3>
          <Button
            disabled={generate.isPending}
            onClick={() => generate.mutate(sessionId)}
            type="button"
            {...testAttr('book-generate-questions')}
          >
            {t('questionGenerate')}
          </Button>
        </div>
        <div className="web-book-question-list mt-4 grid gap-2">
          {generate.isPending &&
            [0, 1, 2].map((item) => (
              <div className="grid gap-2 rounded border p-3" key={item}>
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-9 w-48" />
              </div>
            ))}
          {questions.map((question) => {
            const answered = answeredQuestionIds.has(question.questionId);
            return (
              <div
                className="grid gap-3 rounded border border-stone-200 bg-white p-3"
                key={question.questionId}
                {...testAttr('book-question-row')}
              >
                <div
                  className="web-book-question-text line-clamp-3 text-sm leading-6"
                  {...testAttr('book-question-text')}
                >
                  {question.questionText}
                </div>
                <div className="flex flex-wrap gap-2" {...testAttr('book-question-actions')}>
                  <Button
                    onClick={() =>
                      navigate(`/book/${bookId}/review/questions/${question.questionId}`)
                    }
                    type="button"
                    {...testAttr('book-question-answer')}
                  >
                    {answered ? t('questionAnswerEdit') : t('questionAnswerStart')}
                  </Button>
                  {answered ? (
                    <span
                      className="rounded bg-stone-100 px-3 py-2 text-sm text-stone-500"
                      {...testAttr('book-question-answered')}
                    >
                      {t('questionAnswered')}
                    </span>
                  ) : (
                    <Button
                      disabled={deleteQuestion.isPending}
                      onClick={() => setPendingDeleteQuestionId(question.questionId)}
                      type="button"
                      {...testAttr('book-question-delete')}
                    >
                      {t('delete')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {!generate.isPending && !questions.length && (
            <div className="rounded bg-stone-100 p-4 text-sm text-stone-500">
              {t('questionEmpty')}
            </div>
          )}
        </div>
        <AiProcessingNotice
          action={t('aiActionReflection')}
          className="mt-4"
          dismissDays={QUESTION_AI_NOTICE_DISMISS_DAYS}
          storageKey={QUESTION_AI_NOTICE_COOKIE_KEY}
        />
      </div>
      <ConfirmActionDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        description={t('deleteConfirm')}
        loadingLabel={t('editorLoading')}
        onConfirm={() => {
          if (pendingDeleteQuestionId) deleteQuestion.mutate(pendingDeleteQuestionId);
          setPendingDeleteQuestionId(undefined);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteQuestionId(undefined);
        }}
        open={Boolean(pendingDeleteQuestionId)}
        title={t('delete')}
      />
    </>
  );
}
