import { useMemo } from "react";

import { useApiClient } from "@/shared/api/api-client-provider";
import type { ApiClient } from "@/shared/api/client";

import type {
  DiscussionGuide,
  DiscussionNavigation,
  DiscussionRun,
  EditGuideInput,
  GuideBrief,
  GuideMarkdownExport,
  GuideProjection,
  GuideProjectionResponse,
  GuideVersions,
  GuidedTurn,
  InterviewResponseMode,
  QuestionList,
  QuestionWindow,
  ReflectionInterview,
  ReflectionLoop,
  MobileReflectionThreadList,
  ReflectionRefinement,
  ReflectionRouteAuthority,
  ReflectionTimeline,
  RegenerateGuideInput,
  RefinementMode,
  RefinementOutcome,
  SaveReflectionInput,
} from "./types";

export function createReflectionsApi(client: ApiClient) {
  return {
    reflectionThreads() {
      return client.get<MobileReflectionThreadList>('/api/mobile/reflection-threads');
    },
    completeRun(runId: number, closingNote?: string) {
      return client.post<ReflectionRefinement>(
        `/api/discussion-runs/${runId}/complete`,
        { closingNote },
      );
    },
    continueInterview(interviewId: number) {
      return client.post<ReflectionInterview>(
        `/api/reflection-interviews/${interviewId}/continue`,
        {},
      );
    },
    completeInterview(interviewId: number) {
      return client.post<ReflectionInterview>(
        `/api/reflection-interviews/${interviewId}/complete`,
        {},
      );
    },
    create(sessionId: number, input: SaveReflectionInput) {
      return client.post<ReflectionLoop>(
        `/api/reading-sessions/${sessionId}/reflections`,
        input,
      );
    },
    createQuestionWindow(sessionId: number) {
      return client.post<QuestionWindow>("/api/session-windows", {
        sessionId,
        title: "Reflection Window",
        windowType: "question",
      });
    },
    createGuide(interviewId: number, brief: GuideBrief) {
      return client.post<DiscussionGuide>(
        `/api/reflection-interviews/${interviewId}/guides`,
        brief,
      );
    },
    createRun(guideId: number) {
      return client.post<DiscussionRun>(
        `/api/discussion-guides/${guideId}/runs`,
        {},
      );
    },
    guide(guideId: number) {
      return client.get<DiscussionGuide>(`/api/discussion-guides/${guideId}`);
    },
    guideMarkdown(guideId: number, projection: GuideProjection) {
      return client.get<GuideMarkdownExport>(
        `/api/discussion-guides/${guideId}/exports/markdown?projection=${projection}`,
      );
    },
    async guideProjection(guideId: number, projection: GuideProjection) {
      const value = await client.get<GuideProjectionResponse>(
        `/api/discussion-guides/${guideId}/projections/${projection}`,
      );
      return normalizeGuideProjection(value, projection);
    },
    guideVersions(interviewId: number) {
      return client.get<GuideVersions>(
        `/api/reflection-interviews/${interviewId}/guides`,
      );
    },
    generateQuestions(windowId: number, count = 3, focus?: string) {
      return client.post<QuestionList>(
        `/api/session-windows/${windowId}/questions/generate`,
        { count, focus },
      );
    },
    interview(interviewId: number) {
      return client.get<ReflectionInterview>(
        `/api/reflection-interviews/${interviewId}`,
      );
    },
    editGuide(guideId: number, input: EditGuideInput) {
      return client.post<DiscussionGuide>(
        `/api/discussion-guides/${guideId}/versions`,
        input,
      );
    },
    refinement(runId: number) {
      return client.get<ReflectionRefinement>(
        `/api/discussion-runs/${runId}/refinement`,
      );
    },
    regenerateGuide(guideId: number, input: RegenerateGuideInput) {
      return client.post<DiscussionGuide>(
        `/api/discussion-guides/${guideId}/regenerate`,
        input,
      );
    },
    respond(
      interviewId: number,
      questionId: number,
      mode: InterviewResponseMode,
      content?: string,
    ) {
      return client.post<ReflectionInterview>(
        `/api/reflection-interviews/${interviewId}/responses`,
        { content, mode, questionId },
      );
    },
    run(runId: number) {
      return client.get<DiscussionRun>(`/api/discussion-runs/${runId}`);
    },
    saveRefinement(
      runId: number,
      mode: RefinementMode,
      outcome: RefinementOutcome,
      finalContent?: string,
    ) {
      return client.post<ReflectionLoop>(
        `/api/discussion-runs/${runId}/refinement`,
        { finalContent, mode, outcome },
      );
    },
    sessionReflection(sessionId: number) {
      return client.get<ReflectionLoop>(
        `/api/reading-sessions/${sessionId}/reflection`,
      );
    },
    routeAuthority(sessionId: number) {
      return client.get<ReflectionRouteAuthority>(
        `/api/reading-sessions/${sessionId}/reflection-authority`,
      );
    },
    timeline(sessionId: number) {
      return client.get<ReflectionTimeline>(
        `/api/reading-sessions/${sessionId}`,
      );
    },
    startInterview(reflectionId: number) {
      return client.post<ReflectionInterview>(
        `/api/reflections/${reflectionId}/interviews`,
        {},
      );
    },
    turn(
      runId: number,
      content: string,
      navigation: DiscussionNavigation,
      personaId?: number,
    ) {
      return client.post<GuidedTurn>(`/api/discussion-runs/${runId}/turns`, {
        content,
        navigation,
        personaId,
      });
    },
    update(reflectionId: number, input: SaveReflectionInput) {
      return client.patch<ReflectionLoop>(
        `/api/reflections/${reflectionId}`,
        input,
      );
    },
    saveAnswer(questionId: number, content: string) {
      return client.put<ReflectionTimeline>(
        `/api/questions/${questionId}/answer`,
        { content },
      );
    },
    updateAnswer(
      interviewId: number,
      questionId: number,
      content: string,
      expectedAnswerVersion: number,
      revisionKind: "WORDING_ONLY" | "RESTART_FROM_HERE",
    ) {
      return client.put<ReflectionInterview>(
        `/api/reflection-interviews/${interviewId}/answers/${questionId}`,
        { content, expectedAnswerVersion, revisionKind },
      );
    },
  };
}

export function normalizeGuideProjection(
  value: GuideProjectionResponse,
  requestedProjection: GuideProjection = value.projection,
): GuideProjectionResponse {
  const base = {
    bookAuthor: value.bookAuthor,
    bookTitle: value.bookTitle,
    current: value.current,
    goal: value.goal,
    guideId: value.guideId,
    guideVersion: value.guideVersion,
    issues: [...value.issues],
  };
  if (requestedProjection === "PARTICIPANT") {
    return {
      ...base,
      items: value.items.map(({ order, priority, question, stage }) => ({
        order,
        priority,
        question,
        stage,
      })),
      projection: "PARTICIPANT",
    };
  }
  if (value.projection !== "FACILITATOR") {
    throw new Error("INVALID_GUIDE_PROJECTION");
  }
  return {
    ...base,
    items: value.items.map((item) => ({ ...item, followUps: [...item.followUps] })),
    projection: "FACILITATOR",
    targetMinutes: value.targetMinutes,
  };
}

export function useReflectionsApi() {
  const client = useApiClient();
  return useMemo(() => createReflectionsApi(client), [client]);
}
