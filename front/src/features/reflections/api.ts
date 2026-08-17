import { deleteJson, getJson, patchJson, postJson, putJson } from '@/lib/api-client';
import type { BookListResponse } from '@/types/api/book';
import type {
  DiscussionGuideResponse,
  DiscussionGuideMarkdownExportResponse,
  DiscussionGuideProjection,
  DiscussionGuideProjectionResponse,
  DiscussionGuideVersionsResponse,
  DiscussionNavigation,
  DiscussionRunResponse,
  EditDiscussionGuideInput,
  GuideBriefInput,
  GuidedDiscussionTurnResponse,
  UpdateInterviewAnswerInput,
  InterviewResponseMode,
  ReflectionInterviewResponse,
  ReflectionLoopResponse,
  ReflectionRefinementResponse,
  RegenerateDiscussionGuideInput,
  RefinementMode,
  RefinementOutcome,
  SaveReflectionInput,
} from '@/types/api/reflection-loop';
import type {
  CreateSessionWindowResponse,
  Question,
  QuestionListResponse,
  ReadingSessionListResponse,
  ReadingSessionTimelineResponse,
} from '@/types/api/session';

export interface SessionInsightInput {
  insightType?: string;
  title?: string;
  content: string;
  evidence?: string;
  authorName?: string;
  visibility?: string;
  reviewedOn?: string;
}

export const reflectionsApi = {
  books(): Promise<BookListResponse> {
    return getJson('/api/books');
  },
  sessions(): Promise<ReadingSessionListResponse> {
    return getJson('/api/reading-sessions');
  },

  timeline(sessionId: number): Promise<ReadingSessionTimelineResponse | null> {
    return getJson(`/api/reading-sessions/${sessionId}`);
  },

  createQuestionWindow(sessionId: number): Promise<CreateSessionWindowResponse> {
    return postJson('/api/session-windows', {
      sessionId,
      windowType: 'question',
      title: 'Reflection Window',
    });
  },
  generateQuestions(windowId: number, count = 3, focus?: string): Promise<QuestionListResponse> {
    return postJson(`/api/session-windows/${windowId}/questions/generate`, { count, focus });
  },

  createQuestion(windowId: number, questionText: string): Promise<QuestionListResponse> {
    return postJson(`/api/session-windows/${windowId}/questions`, { questionText });
  },

  deleteQuestion(questionId: number): Promise<Question> {
    return deleteJson(`/api/questions/${questionId}`);
  },

  saveAnswer(questionId: number, content: string): Promise<ReadingSessionTimelineResponse> {
    return putJson(`/api/questions/${questionId}/answer`, { content });
  },

  ensureDebateWindow(questionId: number): Promise<CreateSessionWindowResponse> {
    return putJson(`/api/questions/${questionId}/debate-window`, {});
  },

  createInsight(
    sessionId: number,
    insight: SessionInsightInput,
  ): Promise<ReadingSessionTimelineResponse> {
    return postJson(`/api/reading-sessions/${sessionId}/insights`, insight);
  },

  updateInsight(
    sessionId: number,
    insightId: number,
    insight: SessionInsightInput,
  ): Promise<ReadingSessionTimelineResponse> {
    return patchJson(`/api/reading-sessions/${sessionId}/insights/${insightId}`, insight);
  },

  deleteInsight(sessionId: number, insightId: number): Promise<ReadingSessionTimelineResponse> {
    return deleteJson(`/api/reading-sessions/${sessionId}/insights/${insightId}`);
  },

  createReflection(
    sessionId: number,
    reflection: SaveReflectionInput,
  ): Promise<ReflectionLoopResponse> {
    return postJson(`/api/reading-sessions/${sessionId}/reflections`, reflection);
  },

  reflection(reflectionId: number): Promise<ReflectionLoopResponse> {
    return getJson(`/api/reflections/${reflectionId}`);
  },

  sessionReflection(sessionId: number): Promise<ReflectionLoopResponse> {
    return getJson(`/api/reading-sessions/${sessionId}/reflection`);
  },

  updateReflection(
    reflectionId: number,
    reflection: SaveReflectionInput,
  ): Promise<ReflectionLoopResponse> {
    return patchJson(`/api/reflections/${reflectionId}`, reflection);
  },

  startInterview(reflectionId: number): Promise<ReflectionInterviewResponse> {
    return postJson(`/api/reflections/${reflectionId}/interviews`, {});
  },

  interview(interviewId: number): Promise<ReflectionInterviewResponse> {
    return getJson(`/api/reflection-interviews/${interviewId}`);
  },

  respondToInterview(
    interviewId: number,
    questionId: number,
    mode: InterviewResponseMode,
    content?: string,
  ): Promise<ReflectionInterviewResponse> {
    return postJson(`/api/reflection-interviews/${interviewId}/responses`, {
      questionId,
      mode,
      content,
    });
  },

  updateInterviewAnswer(
    interviewId: number,
    questionId: number,
    input: UpdateInterviewAnswerInput,
  ): Promise<ReflectionInterviewResponse> {
    return putJson(`/api/reflection-interviews/${interviewId}/answers/${questionId}`, input);
  },

  continueInterview(interviewId: number): Promise<ReflectionInterviewResponse> {
    return postJson(`/api/reflection-interviews/${interviewId}/continue`, {});
  },

  createGuide(interviewId: number, brief: GuideBriefInput): Promise<DiscussionGuideResponse> {
    return postJson(`/api/reflection-interviews/${interviewId}/guides`, brief);
  },

  guide(guideId: number): Promise<DiscussionGuideResponse> {
    return getJson(`/api/discussion-guides/${guideId}`);
  },

  guideProjection(
    guideId: number,
    projection: DiscussionGuideProjection,
  ): Promise<DiscussionGuideProjectionResponse> {
    return getJson(`/api/discussion-guides/${guideId}/projections/${projection}`);
  },

  guideMarkdown(
    guideId: number,
    projection: DiscussionGuideProjection,
  ): Promise<DiscussionGuideMarkdownExportResponse> {
    return getJson(`/api/discussion-guides/${guideId}/exports/markdown?projection=${projection}`);
  },

  guideVersions(interviewId: number): Promise<DiscussionGuideVersionsResponse> {
    return getJson(`/api/reflection-interviews/${interviewId}/guides`);
  },

  editGuide(guideId: number, input: EditDiscussionGuideInput): Promise<DiscussionGuideResponse> {
    return postJson(`/api/discussion-guides/${guideId}/versions`, input);
  },

  regenerateGuide(
    guideId: number,
    input: RegenerateDiscussionGuideInput,
  ): Promise<DiscussionGuideResponse> {
    return postJson(`/api/discussion-guides/${guideId}/regenerate`, input);
  },

  createRun(guideId: number): Promise<DiscussionRunResponse> {
    return postJson(`/api/discussion-guides/${guideId}/runs`, {});
  },

  run(runId: number): Promise<DiscussionRunResponse> {
    return getJson(`/api/discussion-runs/${runId}`);
  },

  turn(
    runId: number,
    content: string,
    navigation: DiscussionNavigation,
    personaId?: number,
  ): Promise<GuidedDiscussionTurnResponse> {
    return postJson(`/api/discussion-runs/${runId}/turns`, {
      content,
      navigation,
      personaId,
    });
  },

  completeRun(runId: number, closingNote?: string): Promise<ReflectionRefinementResponse> {
    return postJson(`/api/discussion-runs/${runId}/complete`, { closingNote });
  },

  refinement(runId: number): Promise<ReflectionRefinementResponse> {
    return getJson(`/api/discussion-runs/${runId}/refinement`);
  },

  saveRefinement(
    runId: number,
    mode: RefinementMode,
    outcome: RefinementOutcome,
    finalContent?: string,
  ): Promise<ReflectionLoopResponse> {
    return postJson(`/api/discussion-runs/${runId}/refinement`, {
      mode,
      outcome,
      finalContent,
    });
  },
};
