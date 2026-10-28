import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { useReflectionInterview } from '../use-reflection-interview';
import { ReflectionLoopProgress } from './ReflectionLoopProgress';
import {
  InterviewAnswerProgress,
  InterviewCurrentQuestion,
  InterviewFeedback,
  InterviewGuideActions,
  InterviewHistory,
} from './ReflectionInterviewSections';

export function ReflectionInterviewPanel({ bookId }: { bookId: number }) {
  return <InterviewPanel key={bookId} bookId={bookId} />;
}

function InterviewPanel({ bookId }: { bookId: number }) {
  const { t } = useI18n();
  const interview = useReflectionInterview(bookId);

  if (interview.missing) {
    return (
      <section className="web-reflection-page web-reflection-interview grid gap-4">
        <ReflectionLoopProgress active="interview" bookId={bookId} />
        <div className="rounded border border-stone-300 bg-white p-6">
          <h2 className="text-xl font-semibold">{t('reflectionInterviewMissingTitle')}</h2>
          <Button className="mt-4" onClick={interview.onReflect} type="button">
            {t('reflectionInterviewMissingAction')}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-busy={interview.pending}
      className="web-reflection-page web-reflection-interview grid gap-5"
      {...testAttr('reflection-interview-page')}
    >
      <ReflectionLoopProgress {...interview.progress} />
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">ADAPTIVE INTERVIEW</p>
        <h2 className="text-2xl font-semibold tracking-tight">{t('reflectionInterviewTitle')}</h2>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          {t('reflectionInterviewDescription')}
        </p>
      </header>
      <InterviewFeedback {...interview.feedback} />
      <InterviewAnswerProgress {...interview.summary} />
      <InterviewHistory key={interview.interviewId} {...interview.history} />
      <InterviewCurrentQuestion
        key={`${interview.interviewId}:${interview.question.question?.questionId}`}
        {...interview.question}
      />
      <InterviewGuideActions {...interview.guide} />
    </section>
  );
}
