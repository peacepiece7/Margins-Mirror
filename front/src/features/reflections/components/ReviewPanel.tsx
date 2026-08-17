import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useEnsureQuestionDebateMutation, useReflectionTimelineForBook } from '../queries';
import type { ReviewFilter } from '../panel-types';
import { ReviewPage } from './ReviewPage';

export function ReviewPanel({ bookId }: { bookId: number }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const { sessionId, timeline } = useReflectionTimelineForBook(bookId);
  const ensureDebate = useEnsureQuestionDebateMutation(sessionId);
  const insights = timeline.data?.insights ?? [];
  const filtered = insights.filter((insight) => filter === 'all' || insight.insightType === filter);

  return (
    <ReviewPage
      filter={filter}
      insights={filtered}
      loading={timeline.isFetching || ensureDebate.isPending}
      questions={timeline.data?.questions ?? []}
      selectedBook
      onDiscussAnswer={(questionId) =>
        ensureDebate.mutate(questionId, {
          onSuccess: (window) => navigate(`/book/${bookId}/debate/${window.windowId}`),
        })
      }
      onEditAnswer={(questionId) => navigate(`/book/${bookId}/review/questions/${questionId}`)}
      onEditReview={(insightId) => navigate(`/book/${bookId}/review/${insightId}/edit`)}
      onFilterChange={setFilter}
      onWrite={() => navigate(`/book/${bookId}/review/new`)}
    />
  );
}
