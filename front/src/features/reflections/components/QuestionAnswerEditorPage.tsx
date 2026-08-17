import { Button } from '@/components/ui/button';
import { SpeechDraftControl } from '@/components/speech-draft-control';
import { ReflectionMarkdownEditor } from './ReflectionMarkdownEditor';
import { markdownToPlainText } from '../markdown';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { QuestionAnswerEditorPageProps } from '../panel-types';

export function QuestionAnswerEditorPage({
  answer,
  hasExistingAnswer,
  loading,
  questionText,
  onAnswerChange,
  onCancel,
  onSubmit,
}: QuestionAnswerEditorPageProps) {
  const { t } = useI18n();

  return (
    <section className="grid gap-6" {...testAttr('question-answer-editor-page')}>
      <form
        className="grid min-h-[calc(100vh-220px)] gap-4 rounded border border-stone-300 bg-white p-4 sm:p-5"
        onSubmit={onSubmit}
        {...testAttr('question-answer-form')}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase text-stone-500">
              {t('questionAnswerBadge')}
            </div>
            <h2
              className="mt-1 max-w-4xl text-xl font-semibold leading-8"
              {...testAttr('question-answer-title')}
            >
              {questionText}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded border border-stone-300 px-4 py-2 text-sm font-medium"
              onClick={onCancel}
              type="button"
              {...testAttr('question-answer-cancel')}
            >
              {t('workbenchCancel')}
            </Button>
            <Button
              className="rounded bg-stone-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={loading || !markdownToPlainText(answer)}
              type="submit"
              {...testAttr('question-answer-submit')}
            >
              {hasExistingAnswer ? t('saveEdit') : t('saveRecord')}
            </Button>
          </div>
        </div>
        <div className="grid min-h-[62vh] gap-3 rounded border border-stone-300 bg-stone-100 p-4">
          <div className="reflection-markdown-shell min-h-[54vh] rounded border border-stone-200 bg-white shadow-sm">
            <ReflectionMarkdownEditor
              onChange={onAnswerChange}
              placeholder={t('questionAnswerPlaceholder')}
              textareaTestId="question-answer-textarea"
              value={answer}
            />
          </div>
          <div className="flex justify-end">
            <SpeechDraftControl
              disabled={loading}
              label="question-answer-content"
              onChange={onAnswerChange}
              value={answer}
            />
          </div>
        </div>
      </form>
    </section>
  );
}
