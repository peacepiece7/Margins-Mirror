import { Navigate, useLocation, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';

import { BookHeaderPanel } from '@/features/books/components/BookHeaderPanel';
import { usePersonasQuery } from '@/features/debates/queries';
import { DiscussionGuidePanel } from '@/features/reflections/components/DiscussionGuidePanel';
import { GuidedDiscussionPanel } from '@/features/reflections/components/GuidedDiscussionPanel';
import { QuestionAnswerEditorPanel } from '@/features/reflections/components/QuestionAnswerEditorPanel';
import { ReflectionInterviewPanel } from '@/features/reflections/components/ReflectionInterviewPanel';
import { ReflectionLoopPanel } from '@/features/reflections/components/ReflectionLoopPanel';
import { ReflectionRefinePanel } from '@/features/reflections/components/ReflectionRefinePanel';
import { ReviewEditorPanel } from '@/features/reflections/components/ReviewEditorPanel';
import { ReviewPanel } from '@/features/reflections/components/ReviewPanel';

import { ReadingWorkspacePanelLayout } from './reading-workspace-panel-layout';

function positiveParam(value?: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function ReflectionLayout({ bookId, children }: { bookId: number; children: ReactNode }) {
  return (
    <ReadingWorkspacePanelLayout>
      <BookHeaderPanel bookId={bookId} />
      {children}
    </ReadingWorkspacePanelLayout>
  );
}

export function ReflectionRoute() {
  const bookId = positiveParam(useParams().bookId);
  if (!bookId) return <Navigate replace to="/book/library" />;
  return (
    <ReflectionLayout bookId={bookId}>
      <ReflectionLoopPanel bookId={bookId} />
    </ReflectionLayout>
  );
}

export function ReflectionInterviewRoute() {
  const bookId = positiveParam(useParams().bookId);
  if (!bookId) return <Navigate replace to="/book/library" />;
  return (
    <ReflectionLayout bookId={bookId}>
      <ReflectionInterviewPanel bookId={bookId} />
    </ReflectionLayout>
  );
}

export function DiscussionGuideRoute() {
  const { bookId: rawBookId, guideId: rawGuideId } = useParams();
  const bookId = positiveParam(rawBookId);
  const guideId = positiveParam(rawGuideId);
  if (!bookId || !guideId) {
    return <Navigate replace to={bookId ? `/book/${bookId}/reflection` : '/book/library'} />;
  }
  return (
    <ReflectionLayout bookId={bookId}>
      <DiscussionGuidePanel bookId={bookId} guideId={guideId} />
    </ReflectionLayout>
  );
}

export function GuidedDiscussionRoute() {
  const { bookId: rawBookId, runId: rawRunId } = useParams();
  const bookId = positiveParam(rawBookId);
  const runId = positiveParam(rawRunId);
  const personas = usePersonasQuery();
  if (!bookId || !runId) {
    return <Navigate replace to={bookId ? `/book/${bookId}/reflection` : '/book/library'} />;
  }
  return (
    <ReflectionLayout bookId={bookId}>
      <GuidedDiscussionPanel
        bookId={bookId}
        personas={personas.data?.personas ?? []}
        runId={runId}
      />
    </ReflectionLayout>
  );
}

export function ReflectionRefineRoute() {
  const { bookId: rawBookId, runId: rawRunId } = useParams();
  const bookId = positiveParam(rawBookId);
  const runId = positiveParam(rawRunId);
  if (!bookId || !runId) {
    return <Navigate replace to={bookId ? `/book/${bookId}/reflection` : '/book/library'} />;
  }
  return (
    <ReflectionLayout bookId={bookId}>
      <ReflectionRefinePanel bookId={bookId} runId={runId} />
    </ReflectionLayout>
  );
}

export function LegacyReviewRedirect() {
  const location = useLocation();
  const bookId = positiveParam(useParams().bookId);
  if (!bookId) return <Navigate replace to="/book/library" />;
  const target = location.pathname.includes('/questions/')
    ? `/book/${bookId}/reflection/interview`
    : `/book/${bookId}/reflection`;
  return <Navigate replace to={target} />;
}

export function ReflectionDisabledRedirect() {
  const bookId = positiveParam(useParams().bookId);
  return <Navigate replace to={bookId ? `/book/${bookId}/review` : '/book/library'} />;
}

export function LegacyReviewRoute() {
  const bookId = positiveParam(useParams().bookId);
  if (!bookId) return <Navigate replace to="/book/library" />;
  return (
    <ReflectionLayout bookId={bookId}>
      <ReviewPanel bookId={bookId} />
    </ReflectionLayout>
  );
}

export function LegacyReviewEditorRoute({ create = false }: { create?: boolean }) {
  const { bookId: rawBookId, insightId: rawInsightId } = useParams();
  const bookId = positiveParam(rawBookId);
  const insightId = create ? undefined : positiveParam(rawInsightId);
  if (!bookId || (!create && !insightId)) {
    return <Navigate replace to={bookId ? `/book/${bookId}/review` : '/book/library'} />;
  }
  return (
    <ReflectionLayout bookId={bookId}>
      <ReviewEditorPanel bookId={bookId} insightId={insightId} />
    </ReflectionLayout>
  );
}

export function LegacyQuestionAnswerRoute() {
  const { bookId: rawBookId, questionId: rawQuestionId } = useParams();
  const bookId = positiveParam(rawBookId);
  const questionId = positiveParam(rawQuestionId);
  if (!bookId || !questionId) {
    return <Navigate replace to={bookId ? `/book/${bookId}` : '/book/library'} />;
  }
  return (
    <ReflectionLayout bookId={bookId}>
      <QuestionAnswerEditorPanel bookId={bookId} questionId={questionId} />
    </ReflectionLayout>
  );
}
