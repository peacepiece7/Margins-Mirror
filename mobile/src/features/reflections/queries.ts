import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useReflectionsApi } from "./api";
import type {
  DiscussionNavigation,
  DiscussionRun,
  EditGuideInput,
  GuideBrief,
  GuideProjection,
  InterviewResponseMode,
  ReflectionInterview,
  ReflectionLoop,
  ReflectionTimeline,
  RegenerateGuideInput,
  RefinementMode,
  RefinementOutcome,
  SaveReflectionInput,
  MobileReflectionThreadList,
} from "./types";

export const reflectionKeys = {
  threads: ["reflections", "threads"] as const,
  guide: (id: number) => ["reflections", "guide", id] as const,
  guideProjection: (id: number, projection: GuideProjection) =>
    ["reflections", "guide", id, "projection", projection] as const,
  guideVersions: (interviewId: number) =>
    ["reflections", "interview", interviewId, "guides"] as const,
  interview: (id: number) => ["reflections", "interview", id] as const,
  refinement: (id: number) => ["reflections", "refinement", id] as const,
  run: (id: number) => ["reflections", "run", id] as const,
  session: (id: number) => ["reflections", "session", id] as const,
  sessionAuthority: (id: number) => ["reflections", "session-authority", id] as const,
  timeline: (id: number) => ["reading-sessions", "timeline", id] as const,
};

export function useReflectionThreads() {
  const api = useReflectionsApi();
  return useQuery<MobileReflectionThreadList>({
    queryFn: () => api.reflectionThreads(),
    queryKey: reflectionKeys.threads,
  });
}

function invalidateReflectionThreads(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: reflectionKeys.threads });
}

export async function invalidateReflectionWorkflow(
  queryClient: QueryClient,
  reflection: ReflectionLoop,
) {
  queryClient.setQueryData(
    reflectionKeys.session(reflection.sessionId),
    reflection,
  );
  await queryClient.invalidateQueries({
    queryKey: ["reading-sessions", "timeline", reflection.sessionId],
  });
  await queryClient.invalidateQueries({ queryKey: reflectionKeys.threads });
}

export function useSessionReflection(sessionId: number) {
  const api = useReflectionsApi();
  return useQuery({
    enabled: sessionId > 0,
    queryFn: () => api.sessionReflection(sessionId),
    queryKey: reflectionKeys.session(sessionId),
    retry: false,
  });
}
export function useReflectionRouteAuthority(sessionId: number, enabled: boolean) {
  const api = useReflectionsApi();
  return useQuery({
    enabled: enabled && sessionId > 0,
    queryFn: () => api.routeAuthority(sessionId),
    queryKey: reflectionKeys.sessionAuthority(sessionId),
    retry: false,
  });
}
export function useReflectionTimeline(sessionId: number, enabled = true) {
  const api = useReflectionsApi();
  return useQuery({
    enabled: enabled && sessionId > 0,
    queryFn: () => api.timeline(sessionId),
    queryKey: reflectionKeys.timeline(sessionId),
  });
}
export function useInterview(interviewId: number) {
  const api = useReflectionsApi();
  return useQuery({
    enabled: interviewId > 0,
    queryFn: () => api.interview(interviewId),
    queryKey: reflectionKeys.interview(interviewId),
  });
}
export function useGuide(guideId: number) {
  const api = useReflectionsApi();
  return useQuery({
    enabled: guideId > 0,
    queryFn: () => api.guide(guideId),
    queryKey: reflectionKeys.guide(guideId),
  });
}
export function useGuideProjection(
  guideId: number,
  projection: GuideProjection,
  enabled = true,
) {
  const api = useReflectionsApi();
  return useQuery({
    enabled: enabled && guideId > 0,
    queryFn: () => api.guideProjection(guideId, projection),
    queryKey: reflectionKeys.guideProjection(guideId, projection),
    retry: false,
  });
}
export function useGuideVersions(interviewId?: number) {
  const api = useReflectionsApi();
  return useQuery({
    enabled: Boolean(interviewId && interviewId > 0),
    queryFn: () => api.guideVersions(interviewId!),
    queryKey: reflectionKeys.guideVersions(interviewId ?? 0),
    retry: false,
  });
}
export function useRun(runId: number) {
  const api = useReflectionsApi();
  return useQuery({
    enabled: runId > 0,
    queryFn: () => api.run(runId),
    queryKey: reflectionKeys.run(runId),
  });
}
export function useRefinement(runId: number) {
  const api = useReflectionsApi();
  return useQuery({
    enabled: runId > 0,
    queryFn: () => api.refinement(runId),
    queryKey: reflectionKeys.refinement(runId),
    refetchInterval: (query) =>
      query.state.data?.suggestionStatus === "PENDING" ? 2_000 : false,
  });
}

export function useSaveReflection(sessionId: number, reflectionId?: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveReflectionInput) =>
      reflectionId
        ? api.update(reflectionId, input)
        : api.create(sessionId, input),
    onSuccess: (reflection) => invalidateReflectionWorkflow(qc, reflection),
  });
}
export function useCreateQuestionWindow(sessionId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.createQuestionWindow(sessionId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: reflectionKeys.timeline(sessionId) }),
  });
}
export function useGenerateQuestions(sessionId: number, windowId?: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (focus?: string) => {
      if (!windowId) throw new Error("QUESTION_WINDOW_REQUIRED");
      return api.generateQuestions(windowId, 3, focus);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: reflectionKeys.timeline(sessionId) }),
  });
}
export function useSaveAnswer(sessionId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      content,
      questionId,
    }: {
      content: string;
      questionId: number;
    }) => api.saveAnswer(questionId, content),
    onSuccess: (timeline) =>
      qc.setQueryData(reflectionKeys.timeline(sessionId), timeline),
  });
}
export function useStartInterview() {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reflectionId: number) => api.startInterview(reflectionId),
    onSuccess: (interview) => {
      qc.setQueryData(
        reflectionKeys.interview(interview.interviewId),
        interview,
      );
      void qc.invalidateQueries({ queryKey: ["reflections"] });
    },
  });
}
export function useInterviewResponse(interviewId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      content,
      mode,
      questionId,
    }: {
      content?: string;
      mode: InterviewResponseMode;
      questionId: number;
    }) => api.respond(interviewId, questionId, mode, content),
    onSuccess: (interview) => {
      qc.setQueryData(reflectionKeys.interview(interviewId), interview);
      void invalidateReflectionThreads(qc);
    },
  });
}
export function useContinueInterview(interviewId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.continueInterview(interviewId),
    onSuccess: (interview) => {
      qc.setQueryData(reflectionKeys.interview(interviewId), interview);
      void invalidateReflectionThreads(qc);
    },
  });
}
export function useCompleteInterview(interviewId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.completeInterview(interviewId),
    onSuccess: (interview) => {
      qc.setQueryData(reflectionKeys.interview(interviewId), interview);
      void qc.invalidateQueries({ queryKey: ["reflections", "session"] });
      void invalidateReflectionThreads(qc);
    },
  });
}
export function useUpdateInterviewAnswer(interviewId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      content,
      expectedAnswerVersion,
      questionId,
      revisionKind,
    }: {
      content: string;
      expectedAnswerVersion: number;
      questionId: number;
      revisionKind: "WORDING_ONLY" | "RESTART_FROM_HERE";
    }) =>
      api.updateAnswer(
        interviewId,
        questionId,
        content,
        expectedAnswerVersion,
        revisionKind,
      ),
    onSuccess: (interview) => {
      qc.setQueryData(reflectionKeys.interview(interview.interviewId), interview);
      void qc.invalidateQueries({ queryKey: reflectionKeys.interview(interviewId) });
      void qc.invalidateQueries({ queryKey: ["reflections", "session"] });
      void invalidateReflectionThreads(qc);
    },
  });
}
export function useCreateGuide(interviewId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (brief: GuideBrief) => api.createGuide(interviewId, brief),
    onSuccess: (guide) => {
      qc.setQueryData(reflectionKeys.guide(guide.guideId), guide);
      void qc.invalidateQueries({
        queryKey: reflectionKeys.interview(interviewId),
      });
      void invalidateReflectionThreads(qc);
    },
  });
}
export function useCreateRun(guideId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.createRun(guideId),
    onSuccess: (run) => {
      qc.setQueryData(reflectionKeys.run(run.runId), run);
      void qc.invalidateQueries({ queryKey: reflectionKeys.guide(guideId) });
      void invalidateReflectionThreads(qc);
    },
  });
}
async function refreshGuideLineage(
  qc: QueryClient,
  sourceGuideId: number,
  guide: { guideId: number; interviewId: number },
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: reflectionKeys.guide(sourceGuideId) }),
    qc.invalidateQueries({ queryKey: reflectionKeys.guideVersions(guide.interviewId) }),
    qc.invalidateQueries({ queryKey: reflectionKeys.interview(guide.interviewId) }),
    qc.invalidateQueries({ queryKey: ["reflections", "session"] }),
    invalidateReflectionThreads(qc),
  ]);
}
export function useEditGuide(guideId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EditGuideInput) => api.editGuide(guideId, input),
    onSuccess: async (guide) => {
      qc.setQueryData(reflectionKeys.guide(guide.guideId), guide);
      await refreshGuideLineage(qc, guideId, guide);
    },
  });
}
export function useRegenerateGuide(guideId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegenerateGuideInput) =>
      api.regenerateGuide(guideId, input),
    onSuccess: async (guide) => {
      qc.setQueryData(reflectionKeys.guide(guide.guideId), guide);
      await refreshGuideLineage(qc, guideId, guide);
    },
  });
}
export function useGuideMarkdown(guideId: number) {
  const api = useReflectionsApi();
  return useMutation({
    mutationFn: (projection: GuideProjection) =>
      api.guideMarkdown(guideId, projection),
  });
}
export function useDiscussionTurn(runId: number, sessionId?: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      content: string;
      navigation: DiscussionNavigation;
      personaId?: number;
    }) => api.turn(runId, input.content, input.navigation, input.personaId),
    onMutate: async () => {
      if (sessionId) {
        await qc.cancelQueries({ queryKey: reflectionKeys.timeline(sessionId) });
      }
    },
    onSuccess: (result) => {
      qc.setQueryData(reflectionKeys.run(runId), (current: DiscussionRun | undefined) =>
        current
          ? {
              ...current,
              currentItem: result.nextItem ?? result.currentItem ?? current.currentItem,
              perspectiveCandidates:
                result.perspectiveCandidates ?? current.perspectiveCandidates,
              perspectiveSelectionRequired:
                result.perspectiveSelectionRequired ??
                current.perspectiveSelectionRequired,
              status: result.runStatus,
            }
          : current,
      );
      if (sessionId) {
        qc.setQueryData(
          reflectionKeys.timeline(sessionId),
          (current: ReflectionTimeline | undefined) => {
            if (!current || !result.messages.length) return current;
            const messageIds = new Set(result.messages.map((message) => message.messageId));
            return {
              ...current,
              messages: [
                ...current.messages.filter(
                  (message) => !messageIds.has(message.messageId),
                ),
                ...result.messages,
              ],
            };
          },
        );
      }
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: reflectionKeys.run(runId) }),
        invalidateReflectionThreads(qc),
      ]);
      if (sessionId) {
        await qc.invalidateQueries({
          queryKey: reflectionKeys.timeline(sessionId),
        });
      }
    },
  });
}
export function useCompleteRun(runId: number, sessionId?: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => api.completeRun(runId, note),
    onSuccess: (refinement) => {
      qc.setQueryData(reflectionKeys.refinement(runId), refinement);
      void qc.invalidateQueries({ queryKey: reflectionKeys.run(runId) });
      void invalidateReflectionThreads(qc);
      if (sessionId) {
        void qc.invalidateQueries({
          queryKey: reflectionKeys.timeline(sessionId),
        });
      }
    },
  });
}
export function useSaveRefinement(runId: number) {
  const api = useReflectionsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      finalContent,
      mode,
      outcome,
    }: {
      finalContent?: string;
      mode: RefinementMode;
      outcome: RefinementOutcome;
    }) => api.saveRefinement(runId, mode, outcome, finalContent),
    onSuccess: (reflection) => invalidateReflectionWorkflow(qc, reflection),
  });
}

export function cacheInterview(
  queryClient: QueryClient,
  interview: ReflectionInterview,
) {
  queryClient.setQueryData(
    reflectionKeys.interview(interview.interviewId),
    interview,
  );
}
