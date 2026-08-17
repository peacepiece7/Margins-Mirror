import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useReflectionTimelineForBook, useSaveAnswerMutation } from '../queries';
import { QuestionAnswerEditorPage } from './QuestionAnswerEditorPage';

export function QuestionAnswerEditorPanel({
  bookId,
  questionId,
}: {
  bookId: number;
  questionId: number;
}) {
  const navigate = useNavigate();
  const { sessionId, timeline } = useReflectionTimelineForBook(bookId);
  const question = timeline.data?.questions.find((item) => item.questionId === questionId);
  const existing = timeline.data?.insights.find(
    (insight) => insight.questionId === questionId && insight.insightType === 'question_answer',
  );
  const [answer, setAnswer] = useState('');
  const save = useSaveAnswerMutation(sessionId ?? 0);

  useEffect(() => setAnswer(existing?.content ?? ''), [existing?.content]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!sessionId || !answer.trim() || save.isPending) return;
    save.mutate(
      { questionId, content: answer.trim() },
      { onSuccess: () => navigate(`/book/${bookId}/review`) },
    );
  }

  return (
    <QuestionAnswerEditorPage
      answer={answer}
      hasExistingAnswer={Boolean(existing)}
      loading={timeline.isFetching || save.isPending}
      questionText={question?.questionText ?? ''}
      onAnswerChange={setAnswer}
      onCancel={() => navigate(`/book/${bookId}`)}
      onSubmit={submit}
    />
  );
}
