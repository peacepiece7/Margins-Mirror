import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  useEnsureReflectionSessionMutation,
  useSaveReflectionMutation,
  useReflectionTimelineForBook,
} from '../queries';
import { dateInputValue } from '../review-date';
import { ReviewEditorPage } from './ReviewEditorPage';

export function ReviewEditorPanel({ bookId, insightId }: { bookId: number; insightId?: number }) {
  const navigate = useNavigate();
  const { sessionId, sessions, timeline } = useReflectionTimelineForBook(bookId);
  const insight = timeline.data?.insights.find((item) => item.insightId === insightId);
  const [content, setContent] = useState('');
  const [evidence, setEvidence] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [reviewedOn, setReviewedOn] = useState(() =>
    insightId === undefined ? dateInputValue() : '',
  );
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE');
  const save = useSaveReflectionMutation(bookId, sessionId, insightId);
  const ensureSession = useEnsureReflectionSessionMutation(bookId);

  useEffect(() => {
    if (!sessions.isLoading && !sessionId && !ensureSession.isPending) {
      ensureSession.mutate(undefined);
    }
  }, [ensureSession, sessionId, sessions.isLoading]);

  useEffect(() => {
    if (!insight) return;
    setContent(insight.content);
    setEvidence(insight.evidence ?? '');
    setAuthorName(insight.authorName ?? '');
    setReviewedOn(insight.reviewedOn ?? '');
    setVisibility(insight.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE');
  }, [insight]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim() || save.isPending) return;
    save.mutate(
      {
        insightType: 'reflection',
        title: 'Review',
        content: content.trim(),
        evidence: evidence.trim() || undefined,
        authorName: authorName.trim() || undefined,
        reviewedOn: reviewedOn || undefined,
        visibility,
      },
      { onSuccess: () => navigate(`/book/${bookId}/review`) },
    );
  }

  return (
    <ReviewEditorPage
      authorName={authorName}
      content={content}
      evidence={evidence}
      isEditing={Boolean(insightId)}
      loading={save.isPending || timeline.isFetching}
      reviewedOn={reviewedOn}
      visibility={visibility}
      onAuthorNameChange={setAuthorName}
      onCancel={() => navigate(`/book/${bookId}/review`)}
      onContentChange={setContent}
      onEvidenceChange={setEvidence}
      onReviewedOnChange={setReviewedOn}
      onSubmit={submit}
      onVisibilityChange={setVisibility}
    />
  );
}
