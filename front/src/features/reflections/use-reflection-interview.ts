import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  GuideBriefInput,
  InterviewAnswer,
  InterviewAnswerRevisionKind,
} from '@/types/api/reflection-loop';

import { useReflectionTimelineForBook } from './queries';
import {
  useCreateDiscussionGuideMutation,
  useContinueReflectionInterviewMutation,
  useInterviewResponseMutation,
  useUpdateInterviewAnswerMutation,
  useReflectionInterviewQuery,
  useReflectionLoopQuery,
  useStartReflectionInterviewMutation,
} from './reflection-loop-queries';
import { findPrimaryReflection } from './reflection-loop-state';
import { reflectionRequestId } from './reflection-loop-ui';

const defaultGuideBrief: GuideBriefInput = {
  purpose: 'THOUGHT_EXPANSION',
  audienceMode: 'SMALL_GROUP',
  targetMinutes: 20,
  disclosureMode: 'PRIVATE_CONTEXT',
  facilitationLevel: 'BEGINNER',
};

export function useReflectionInterview(bookId: number) {
  const navigate = useNavigate();
  const { timeline } = useReflectionTimelineForBook(bookId);
  const reflectionId = findPrimaryReflection(timeline.data?.insights)?.insightId;
  const reflection = useReflectionLoopQuery(reflectionId);
  const start = useStartReflectionInterviewMutation();
  const interviewId = reflection.data?.activeInterviewId;
  const interview = useReflectionInterviewQuery(interviewId ?? undefined);
  const respond = useInterviewResponseMutation(interviewId ?? 0);
  const updateAnswer = useUpdateInterviewAnswerMutation(interviewId ?? 0);
  const createGuide = useCreateDiscussionGuideMutation(interviewId ?? 0);
  const continueInterview = useContinueReflectionInterviewMutation(interviewId ?? 0);
  const [guideBrief, setGuideBrief] = useState<GuideBriefInput>(defaultGuideBrief);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const startMutation = start.mutate;

  useEffect(() => {
    if (
      reflectionId &&
      reflection.isSuccess &&
      !interviewId &&
      !start.isPending &&
      !start.isError
    ) {
      startMutation(reflectionId);
    }
  }, [
    interviewId,
    reflection.isSuccess,
    reflectionId,
    start.isError,
    start.isPending,
    startMutation,
  ]);

  const data = interview.data;
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

  function send(mode: 'ANSWER' | 'BOOK_ONLY' | 'SKIP', content: string) {
    if (!data?.currentQuestion || pending || (mode === 'ANSWER' && !content.trim())) return;
    respond.mutate(
      {
        questionId: data.currentQuestion.questionId,
        mode,
        content: mode === 'ANSWER' ? content.trim() : undefined,
      },
      { onSuccess: () => requestAnimationFrame(() => answerRef.current?.focus()) },
    );
  }

  function saveAnswer(
    savedAnswer: InterviewAnswer,
    revisionKind: InterviewAnswerRevisionKind,
    content: string,
    onSuccess: () => void,
  ) {
    if (!content.trim() || pending) return;
    updateAnswer.mutate(
      {
        questionId: savedAnswer.questionId,
        expectedAnswerVersion: savedAnswer.version,
        content: content.trim(),
        revisionKind,
      },
      { onSuccess },
    );
  }

  function createDiscussionGuide() {
    if (!data?.canGenerateGuide || data.guideId || pending) return;
    createGuide.mutate(guideBrief, {
      onSuccess: (guide) => navigate(`/book/${bookId}/reflection/guide/${guide.guideId}`),
    });
  }

  return {
    bookId,
    interviewId,
    pending,
    missing: !timeline.isFetching && !reflectionId,
    onReflect: () => navigate(`/book/${bookId}/reflection`),
    progress: {
      active: 'interview' as const,
      bookId,
      paths: {
        reflect: `/book/${bookId}/reflection`,
        interview: `/book/${bookId}/reflection/interview`,
      },
    },
    feedback: {
      operationError,
      onRetryStart:
        start.isError && reflectionId
          ? () => {
              start.reset();
              start.mutate(reflectionId);
            }
          : undefined,
      onReload:
        timeline.isError || reflection.isError || interview.isError
          ? () => {
              if (timeline.isError) void timeline.refetch();
              if (reflection.isError) void reflection.refetch();
              if (interview.isError) void interview.refetch();
            }
          : undefined,
      guideError: createGuide.error,
      guideRequestId: reflectionRequestId(createGuide.error),
      creatingGuide: createGuide.isPending,
      onRetryGuide: () => {
        createGuide.reset();
        createDiscussionGuide();
      },
    },
    summary: {
      data,
      progress: data
        ? Math.min(100, Math.round((data.answeredCount / data.targetAnswers) * 100))
        : 0,
    },
    history: { answers: data?.answers ?? [], pending, onSave: saveAnswer },
    question: {
      bookId,
      interviewId,
      data,
      question: data?.currentQuestion,
      pending,
      answerRef,
      onSend: send,
      pendingMode: respond.isPending ? respond.variables?.mode : undefined,
      continuing: continueInterview.isPending,
      onContinue: () => {
        if (!pending) continueInterview.mutate();
      },
    },
    guide: {
      data,
      pending,
      creating: createGuide.isPending,
      brief: guideBrief,
      onBriefChange: setGuideBrief,
      onCreateOrView: () => {
        if (data?.guideId) navigate(`/book/${bookId}/reflection/guide/${data.guideId}`);
        else createDiscussionGuide();
      },
    },
  };
}

export type ReflectionInterview = ReturnType<typeof useReflectionInterview>;
