import { Button } from '@/components/ui/button';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { ReviewPageProps } from '../panel-types';

function displayDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function ReviewPage({
  filter,
  insights,
  loading,
  questions,
  selectedBook,
  onDiscussAnswer,
  onEditAnswer,
  onEditReview,
  onFilterChange,
  onWrite,
}: ReviewPageProps) {
  const { t } = useI18n();

  return (
    <section className="grid gap-4" {...testAttr('review-page')}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_18px_50px_rgba(23,23,23,0.06)] sm:p-5">
        <h2 className="font-display text-3xl font-semibold tracking-normal">
          {t('reviewListTitle')}
        </h2>
        <Button
          className="rounded bg-stone-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!selectedBook || loading}
          onClick={onWrite}
          type="button"
          {...testAttr('review-write')}
        >
          {t('startReview')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2" {...testAttr('review-filter')}>
        {(
          [
            ['all', t('reviewFilterAll')],
            ['reflection', t('reviewFilterReviews')],
            ['question_answer', t('reviewFilterQuestionAnswers')],
          ] as const
        ).map(([value, label]) => (
          <Button
            aria-pressed={filter === value}
            className={`rounded border px-3 py-2 text-sm font-medium ${filter === value ? 'border-stone-950 bg-stone-950 text-white' : 'border-stone-300 bg-white text-stone-700'}`}
            key={value}
            onClick={() => onFilterChange(value)}
            type="button"
            {...testAttr(`review-filter-${value}`)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3" {...testAttr('reflection-list')}>
        {insights.map((insight) => {
          const answerQuestion = insight.questionId
            ? questions.find((question) => question.questionId === insight.questionId)
            : undefined;
          const isQuestionAnswer = insight.insightType === 'question_answer';
          return (
            <article
              className="rounded border border-stone-300 bg-white p-4"
              key={insight.insightId}
              {...testAttr('reflection-list-item')}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase text-stone-500">
                    {isQuestionAnswer ? t('questionAnswerBadge') : t('review')}
                  </div>
                  {(answerQuestion?.questionText || insight.title) && (
                    <h3 className="mt-1 text-base font-semibold leading-6">
                      {answerQuestion?.questionText || insight.title}
                    </h3>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                    {insight.authorName && (
                      <span>
                        {t('reviewAuthorLabel')}: {insight.authorName}
                      </span>
                    )}
                    {insight.reviewedOn && (
                      <span>
                        {t('reviewDateLabel')}: {insight.reviewedOn}
                      </span>
                    )}
                    <span>
                      {insight.visibility === 'PUBLIC'
                        ? t('reviewVisibilityPublic')
                        : t('reviewVisibilityPrivate')}
                    </span>
                    {insight.updatedAt && (
                      <span>
                        {t('reviewUpdatedLabel')}: {displayDateTime(insight.updatedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="rounded border border-stone-300 px-3 py-1.5 text-xs font-medium"
                    onClick={() =>
                      isQuestionAnswer && insight.questionId
                        ? onEditAnswer(insight.questionId)
                        : onEditReview(insight.insightId)
                    }
                    type="button"
                    {...testAttr(isQuestionAnswer ? 'question-answer-edit' : 'reflection-edit')}
                  >
                    {t('edit')}
                  </Button>
                  {isQuestionAnswer && insight.questionId && (
                    <Button
                      className="rounded bg-stone-950 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      disabled={loading}
                      onClick={() => onDiscussAnswer(insight.questionId as number)}
                      type="button"
                      {...testAttr('question-answer-debate')}
                    >
                      {t('questionDebate')}
                    </Button>
                  )}
                </div>
              </div>
              <MarkdownContent
                className="mt-1 text-sm leading-6"
                preserveLineBreaks
                value={insight.content}
              />
              {insight.evidence && (
                <div className="mt-1 text-xs text-stone-600">{insight.evidence}</div>
              )}
            </article>
          );
        })}
        {!insights.length && (
          <div
            className="rounded border border-stone-300 bg-white p-8 text-center text-sm text-stone-500"
            {...testAttr('reflection-list-empty')}
          >
            {t('reviewListEmpty')}
          </div>
        )}
      </div>
    </section>
  );
}
