import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { publicReviewKeys, reflectionLoopKeys, sessionKeys } from '@/lib/query-keys';
import type {
  DiscussionGuideProjection,
  DiscussionNavigation,
  EditDiscussionGuideInput,
  GuideBriefInput,
  InterviewResponseMode,
  ReflectionRefinementResponse,
  RefinementMode,
  RefinementOutcome,
  SaveReflectionInput,
  UpdateInterviewAnswerInput,
} from '@/types/api/reflection-loop';
import type {
  AiMessageResponse,
  ReadingSessionTimelineResponse,
  SessionMessage,
} from '@/types/api/session';

import { reflectionsApi } from './api';

export const reflectionLoopQueryOptions = {
  reflection: (reflectionId: number) =>
    queryOptions({
      queryKey: reflectionLoopKeys.reflection(reflectionId),
      queryFn: () => reflectionsApi.reflection(reflectionId),
      enabled: reflectionId > 0,
    }),
  sessionReflection: (sessionId: number) =>
    queryOptions({
      queryKey: reflectionLoopKeys.sessionReflection(sessionId),
      queryFn: () => reflectionsApi.sessionReflection(sessionId),
      enabled: sessionId > 0,
      retry: false,
    }),
  interview: (interviewId: number) =>
    queryOptions({
      queryKey: reflectionLoopKeys.interview(interviewId),
      queryFn: () => reflectionsApi.interview(interviewId),
      enabled: interviewId > 0,
    }),
  guide: (guideId: number) =>
    queryOptions({
      queryKey: reflectionLoopKeys.guide(guideId),
      queryFn: () => reflectionsApi.guide(guideId),
      enabled: guideId > 0,
    }),
  guideProjection: (guideId: number, projection: DiscussionGuideProjection) =>
    queryOptions({
      queryKey: reflectionLoopKeys.guideProjection(guideId, projection),
      queryFn: () => reflectionsApi.guideProjection(guideId, projection),
      enabled: guideId > 0,
    }),
  guideVersions: (interviewId: number) =>
    queryOptions({
      queryKey: reflectionLoopKeys.guideVersions(interviewId),
      queryFn: () => reflectionsApi.guideVersions(interviewId),
      enabled: interviewId > 0,
    }),
  run: (runId: number) =>
    queryOptions({
      queryKey: reflectionLoopKeys.run(runId),
      queryFn: () => reflectionsApi.run(runId),
      enabled: runId > 0,
    }),
};

export function useReflectionLoopQuery(reflectionId?: number) {
  return useQuery({
    ...reflectionLoopQueryOptions.reflection(reflectionId ?? 0),
    enabled: Boolean(reflectionId),
  });
}

export function useSessionReflectionQuery(sessionId?: number) {
  return useQuery({
    ...reflectionLoopQueryOptions.sessionReflection(sessionId ?? 0),
    enabled: Boolean(sessionId),
  });
}

export function useReflectionInterviewQuery(interviewId?: number) {
  return useQuery({
    ...reflectionLoopQueryOptions.interview(interviewId ?? 0),
    enabled: Boolean(interviewId),
  });
}

export function useDiscussionGuideQuery(guideId: number) {
  return useQuery(reflectionLoopQueryOptions.guide(guideId));
}

export function useDiscussionGuideProjectionQuery(
  guideId: number,
  projection: DiscussionGuideProjection,
) {
  return useQuery(reflectionLoopQueryOptions.guideProjection(guideId, projection));
}

export function useDiscussionGuideVersionsQuery(interviewId?: number) {
  return useQuery({
    ...reflectionLoopQueryOptions.guideVersions(interviewId ?? 0),
    enabled: Boolean(interviewId),
  });
}

export function useDiscussionRunQuery(runId: number) {
  return useQuery(reflectionLoopQueryOptions.run(runId));
}

export function mergeGuidedDiscussionMessages(
  timeline: ReadingSessionTimelineResponse,
  messages: AiMessageResponse[],
): ReadingSessionTimelineResponse {
  const knownIds = new Set(timeline.messages.map((message) => message.messageId));
  const latestOrder = timeline.messages.reduce(
    (maximum, message) => Math.max(maximum, message.messageOrder),
    0,
  );
  const appended = messages
    .filter((message) => !knownIds.has(message.messageId))
    .map<SessionMessage>((message, index) => ({
      ...message,
      sessionId: timeline.sessionId,
      messageOrder: latestOrder + index + 1,
      streamingStatus: message.streamingReady ? 'streaming' : 'completed',
      createdAt: new Date().toISOString(),
    }));

  if (!appended.length) return timeline;
  return { ...timeline, messages: [...timeline.messages, ...appended] };
}

export function useSavePrimaryReflectionMutation(sessionId?: number, reflectionId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveReflectionInput) => {
      if (!sessionId) throw new Error('독서 세션을 준비하고 있습니다.');
      return reflectionId
        ? reflectionsApi.updateReflection(reflectionId, input)
        : reflectionsApi.createReflection(sessionId, input);
    },
    onSuccess: async (reflection) => {
      queryClient.setQueryData(reflectionLoopKeys.reflection(reflection.reflectionId), reflection);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.reflections() }),
        queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(reflection.sessionId) }),
        queryClient.invalidateQueries({ queryKey: publicReviewKeys.lists() }),
      ]);
    },
  });
}

export function useStartReflectionInterviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reflectionsApi.startInterview,
    onSuccess: async (interview) => {
      queryClient.setQueryData(reflectionLoopKeys.interview(interview.interviewId), interview);
      await queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.reflections() });
      await queryClient.invalidateQueries({
        queryKey: reflectionLoopKeys.reflection(interview.reflectionId),
      });
    },
  });
}

export function useInterviewResponseMutation(interviewId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      mode,
      content,
    }: {
      questionId: number;
      mode: InterviewResponseMode;
      content?: string;
    }) => reflectionsApi.respondToInterview(interviewId, questionId, mode, content),
    onSuccess: (interview) => {
      queryClient.setQueryData(reflectionLoopKeys.interview(interviewId), interview);
      void queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.reflections() });
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });
}

export function useUpdateInterviewAnswerMutation(interviewId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, ...input }: UpdateInterviewAnswerInput & { questionId: number }) =>
      reflectionsApi.updateInterviewAnswer(interviewId, questionId, input),
    onSuccess: async (interview) => {
      queryClient.setQueryData(reflectionLoopKeys.interview(interview.interviewId), interview);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.reflections() }),
        queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.interview(interviewId) }),
        queryClient.invalidateQueries({
          queryKey: reflectionLoopKeys.reflection(interview.reflectionId),
        }),
        queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
      ]);
    },
  });
}

export function useContinueReflectionInterviewMutation(interviewId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reflectionsApi.continueInterview(interviewId),
    onSuccess: (interview) => {
      queryClient.setQueryData(reflectionLoopKeys.interview(interviewId), interview);
    },
  });
}

export function useCreateDiscussionGuideMutation(interviewId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (brief: GuideBriefInput) => reflectionsApi.createGuide(interviewId, brief),
    onSuccess: (guide) => {
      queryClient.setQueryData(reflectionLoopKeys.guide(guide.guideId), guide);
      void queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.reflections() });
      queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.interview(interviewId) });
    },
  });
}

export function useEditDiscussionGuideMutation(guideId: number, interviewId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditDiscussionGuideInput) => reflectionsApi.editGuide(guideId, input),
    onSuccess: async (guide) => {
      queryClient.setQueryData(reflectionLoopKeys.guide(guide.guideId), guide);
      void queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.reflections() });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.guide(guideId) }),
        queryClient.invalidateQueries({
          queryKey: reflectionLoopKeys.guideVersions(interviewId ?? guide.interviewId),
        }),
        queryClient.invalidateQueries({
          queryKey: reflectionLoopKeys.interview(guide.interviewId),
        }),
        queryClient.invalidateQueries({
          queryKey: reflectionLoopKeys.reflection(guide.reflectionId),
        }),
      ]);
    },
  });
}

export function useRegenerateDiscussionGuideMutation(guideId: number, interviewId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { expectedVersion: number; brief: GuideBriefInput }) =>
      reflectionsApi.regenerateGuide(guideId, input),
    onSuccess: async (guide) => {
      queryClient.setQueryData(reflectionLoopKeys.guide(guide.guideId), guide);
      void queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.reflections() });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.guide(guideId) }),
        queryClient.invalidateQueries({
          queryKey: reflectionLoopKeys.guideVersions(interviewId ?? guide.interviewId),
        }),
        queryClient.invalidateQueries({
          queryKey: reflectionLoopKeys.interview(guide.interviewId),
        }),
        queryClient.invalidateQueries({
          queryKey: reflectionLoopKeys.reflection(guide.reflectionId),
        }),
      ]);
    },
  });
}

export function useDiscussionGuideMarkdownExportMutation(guideId: number) {
  return useMutation({
    mutationFn: (projection: DiscussionGuideProjection) =>
      reflectionsApi.guideMarkdown(guideId, projection),
  });
}

export function useCreateDiscussionRunMutation(guideId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reflectionsApi.createRun(guideId),
    onSuccess: async (run) => {
      queryClient.setQueryData(reflectionLoopKeys.run(run.runId), run);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.guide(guideId) }),
        queryClient.invalidateQueries({
          queryKey: reflectionLoopKeys.sessionReflection(run.sessionId),
        }),
      ]);
    },
  });
}

export function useGuidedDiscussionTurnMutation(runId: number, sessionId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      content,
      navigation,
      personaId,
    }: {
      content: string;
      navigation: DiscussionNavigation;
      personaId?: number;
    }) => reflectionsApi.turn(runId, content, navigation, personaId),
    onSuccess: async (turn) => {
      queryClient.setQueryData(reflectionLoopKeys.run(runId), (current) =>
        current
          ? {
              ...current,
              status: turn.runStatus,
              currentItem: turn.currentItem,
              lastDirectorAction: turn.directorAction,
              perspectiveCandidates: turn.perspectiveCandidates ?? [],
              perspectiveSelectionRequired: turn.perspectiveSelectionRequired,
            }
          : current,
      );
      if (sessionId && turn.messages.length) {
        const timelineKey = sessionKeys.timeline(sessionId);
        await queryClient.cancelQueries({ queryKey: timelineKey, exact: true });
        queryClient.setQueryData<ReadingSessionTimelineResponse>(timelineKey, (timeline) =>
          timeline ? mergeGuidedDiscussionMessages(timeline, turn.messages) : timeline,
        );
      }
      await queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.run(runId) });
      if (sessionId) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: sessionKeys.timeline(sessionId),
          }),
          queryClient.invalidateQueries({
            queryKey: reflectionLoopKeys.sessionReflection(sessionId),
          }),
        ]);
      }
      return turn;
    },
  });
}

export function useCompleteDiscussionRunMutation(runId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reflectionsApi.completeRun(runId),
    onSuccess: async (refinement) => {
      queryClient.setQueryData<ReflectionRefinementResponse>(
        reflectionLoopKeys.refinement(runId),
        refinement,
      );
      const run = queryClient.getQueryData(reflectionLoopKeys.run(runId)) as
        { sessionId?: number } | undefined;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.run(runId) }),
        ...(run?.sessionId
          ? [
              queryClient.invalidateQueries({
                queryKey: reflectionLoopKeys.sessionReflection(run.sessionId),
              }),
            ]
          : []),
      ]);
    },
  });
}

export function useReflectionRefinementQuery(runId: number) {
  return useQuery({
    queryKey: reflectionLoopKeys.refinement(runId),
    queryFn: () => reflectionsApi.refinement(runId),
    refetchInterval: (query) => (query.state.data?.suggestionStatus === 'PENDING' ? 1_000 : false),
  });
}

export function useSaveReflectionRefinementMutation(runId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      mode,
      outcome,
      finalContent,
    }: {
      mode: RefinementMode;
      outcome: RefinementOutcome;
      finalContent?: string;
    }) => reflectionsApi.saveRefinement(runId, mode, outcome, finalContent),
    onSuccess: async (reflection) => {
      queryClient.setQueryData(reflectionLoopKeys.reflection(reflection.reflectionId), reflection);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.reflections() }),
        queryClient.invalidateQueries({ queryKey: reflectionLoopKeys.run(runId) }),
        queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(reflection.sessionId) }),
        queryClient.invalidateQueries({ queryKey: publicReviewKeys.lists() }),
      ]);
    },
  });
}
