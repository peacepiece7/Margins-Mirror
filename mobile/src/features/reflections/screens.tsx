import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { ApiRequestError } from "@/shared/api/error";
import { colors, radius, spacing } from "@/shared/theme/tokens";
import {
  AppText,
  Button,
  EditorialHeader,
  LoadingState,
  Notice,
  Screen,
  Surface,
  TextField,
} from "@/shared/ui";

import { reflectionCopy } from "./copy";
import { guideStages, reflectionLabels } from "./labels";
import { ReflectionMarkdown } from "./markdown";
import {
  useContinueInterview,
  useCompleteInterview,
  useCreateGuide,
  useCreateQuestionWindow,
  useDiscussionTurn,
  useGenerateQuestions,
  useGuide,
  useInterview,
  useInterviewResponse,
  useRefinement,
  useReflectionTimeline,
  useReflectionRouteAuthority,
  useRun,
  useSaveAnswer,
  useSaveRefinement,
  useSaveReflection,
  useSessionReflection,
  useStartInterview,
  useUpdateInterviewAnswer,
} from "./queries";
import {
  buildDiscussionTurn,
  buildBookQuestionFocus,
  buildReflectionSaveInput,
  deviceLocalDate,
  hasReflectionDraftChanges,
  refinementSaveMode,
  resolveReflectionStageTarget,
  resolveReflectionWorkflowTarget,
  shouldClearDiscussionDraft,
} from "./workflow-inputs";
import { ownsInterviewRoute, ownsReflectionRoute } from "./route-ownership";
import type { ReflectionLoopStage, ReflectionStageTarget } from "./workflow-inputs";
import type { GuideBrief, GuidedTurn, ReflectionLoop, ReflectionWorkflowTarget, RefinementOutcome } from "./types";

const defaultGuideBrief: GuideBrief = {
  audienceMode: "SMALL_GROUP",
  disclosureMode: "PRIVATE_CONTEXT",
  facilitationLevel: "BEGINNER",
  purpose: "THOUGHT_EXPANSION",
  targetMinutes: 20,
};

function formatMessageTimestamp(value: string | null | undefined, locale: "en" | "ko") {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

export function ReflectionScreen({
  bookAuthor,
  bookId,
  bookTitle,
  onBack,
  onCloseSourceRevision,
  onWorkflow,
  sessionId,
  sourceRevisionId,
}: {
  bookAuthor?: string;
  bookId: number;
  bookTitle: string;
  onBack?(): void;
  onCloseSourceRevision?(): void;
  onWorkflow(target: ReflectionWorkflowTarget): void;
  sessionId: number;
  sourceRevisionId?: number;
}) {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const reflection = useSessionReflection(sessionId);
  const missingReflection =
    reflection.isError &&
    reflection.error instanceof ApiRequestError &&
    reflection.error.status === 404;
  const routeAuthority = useReflectionRouteAuthority(sessionId, missingReflection);
  const [timelineSurface, setTimelineSurface] = useState<"notes" | "questions" | null>(null);
  const timelineVisible = timelineSurface !== null;
  const timeline = useReflectionTimeline(
    sessionId,
    timelineVisible || Boolean(sourceRevisionId),
  );
  const pageHeader = (
    title: string = c.reflection,
    page = false,
    backAction = onBack,
  ) => (
    <EditorialHeader
      backLabel={c.backToReflection}
      onBack={backAction}
      page={page}
      title={title}
    />
  );
  if (reflection.isLoading || (missingReflection && routeAuthority.isLoading))
    return (
      <Screen scroll={false}>
        {pageHeader()}
        <LoadingState label={c.reflection} />
      </Screen>
    );
  if (
    reflection.isError &&
    !(
      reflection.error instanceof ApiRequestError &&
      reflection.error.status === 404
    )
  ) {
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.error} tone="error" />
        <Button
          onPress={() => void reflection.refetch()}
          testID="reflection-load-retry"
          variant="outline"
        >
          {c.retry}
        </Button>
      </Screen>
    );
  }
  const authorityNotFound =
    missingReflection &&
    routeAuthority.isError &&
    routeAuthority.error instanceof ApiRequestError &&
    routeAuthority.error.status === 404;
  if (missingReflection && routeAuthority.isError && !authorityNotFound) {
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.error} tone="error" />
        <Button onPress={() => void routeAuthority.refetch()} variant="outline">
          {c.retry}
        </Button>
      </Screen>
    );
  }
  if (
    (reflection.data &&
      (reflection.data.bookId !== bookId || reflection.data.sessionId !== sessionId)) ||
    (missingReflection &&
      (authorityNotFound ||
        !routeAuthority.data ||
        routeAuthority.data.bookId !== bookId ||
        routeAuthority.data.sessionId !== sessionId))
  ) {
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  }
  if (sourceRevisionId && timeline.isLoading) {
    return (
      <Screen scroll={false}>
        {pageHeader(c.sourceRevisionTitle, false, onCloseSourceRevision ?? onBack)}
        <LoadingState label={c.sourceRevisionTitle} />
      </Screen>
    );
  }
  if (sourceRevisionId && timeline.isError) {
    return (
      <Screen>
        {pageHeader(c.sourceRevisionTitle, false, onCloseSourceRevision ?? onBack)}
        <Notice title={c.error} tone="error" />
        <Button onPress={() => void timeline.refetch()} variant="outline">
          {c.retry}
        </Button>
      </Screen>
    );
  }
  if (
    (timelineVisible || Boolean(sourceRevisionId)) &&
    timeline.data &&
    !ownsReflectionRoute(timeline.data, bookId, sessionId)
  ) {
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  }
  if (sourceRevisionId) {
    const revision = reflection.data?.revisions.find(
      (item) => item.revisionId === sourceRevisionId,
    );
    if (!revision) {
      return <Screen>
        {pageHeader(c.sourceRevisionTitle, false, onCloseSourceRevision ?? onBack)}
        <Notice title={c.notFound} tone="error" />
      </Screen>;
    }
    return (
      <Screen testID="reflection-source-revision-screen">
        {pageHeader(c.sourceRevisionTitle, false, onCloseSourceRevision ?? onBack)}
        <AppText variant="caption">
          {c.sourceRevision} #{revision.revisionId} · v{revision.version}
        </AppText>
        <Surface><ReflectionMarkdown content={revision.content} /></Surface>
      </Screen>
    );
  }
  const metadata = reflection.data
    ? {
        authorName: reflection.data.authorName ?? undefined,
        content: reflection.data.currentRevision.content,
        evidence: reflection.data.evidence ?? undefined,
        insightId: reflection.data.reflectionId,
        insightType: "reflection",
        reviewedOn: reflection.data.reviewedOn ?? undefined,
        title: reflection.data.title,
        visibility: reflection.data.visibility,
      }
    : undefined;
  const savedMetadata = timeline.data?.insights.find(
    (insight) => insight.insightId === reflection.data?.reflectionId,
  );
  if (timelineVisible && timeline.data && reflection.data && !savedMetadata) {
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.error} tone="error" />
      </Screen>
    );
  }
  return (
    <ReflectionEditor
      key={reflection.data?.currentRevision.revisionId ?? "new"}
      bookAuthor={bookAuthor}
      bookTitle={bookTitle}
      c={c}
      metadata={metadata}
      onBack={onBack}
      savedMetadata={savedMetadata}
      onTimelineSurface={setTimelineSurface}
      onTimelineRetry={() => void timeline.refetch()}
      onWorkflow={onWorkflow}
      reflection={reflection.data}
      sessionId={sessionId}
      timeline={timeline.data}
      timelineError={timelineVisible && timeline.isError}
      timelineLoading={timelineVisible && timeline.isLoading}
      timelineSurface={timelineSurface}
    />
  );
}

function ReflectionEditor({
  bookAuthor,
  bookTitle,
  c,
  metadata,
  onBack,
  savedMetadata,
  onTimelineSurface,
  onTimelineRetry,
  onWorkflow,
  reflection,
  sessionId,
  timeline,
  timelineError,
  timelineLoading,
  timelineSurface,
}: {
  bookAuthor?: string;
  bookTitle: string;
  c: ReturnType<typeof reflectionCopy>;
  metadata?: NonNullable<ReturnType<typeof useReflectionTimeline>["data"]>["insights"][number];
  onBack?(): void;
  savedMetadata?: NonNullable<ReturnType<typeof useReflectionTimeline>["data"]>["insights"][number];
  onTimelineSurface(value: "notes" | "questions" | null): void;
  onTimelineRetry(): void;
  onWorkflow(target: ReflectionWorkflowTarget): void;
  reflection?: ReturnType<typeof useSessionReflection>["data"];
  sessionId: number;
  timeline?: ReturnType<typeof useReflectionTimeline>["data"];
  timelineError: boolean;
  timelineLoading: boolean;
  timelineSurface: "notes" | "questions" | null;
}) {
  const initialContent = reflection?.currentRevision.content ?? "";
  const initialEvidence = metadata?.evidence ?? "";
  const initialAuthorName = metadata?.authorName ?? "";
  const initialReviewedOn = metadata?.reviewedOn ?? (reflection ? "" : deviceLocalDate());
  const initialVisibility =
    metadata?.visibility === "PUBLIC" || reflection?.visibility === "PUBLIC"
      ? "PUBLIC"
      : "PRIVATE";
  const [content, setContent] = useState(initialContent);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [authorName, setAuthorName] = useState(initialAuthorName);
  const [reviewedOn, setReviewedOn] = useState(initialReviewedOn);
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">(
    initialVisibility,
  );
  const [persistedMetadata, setPersistedMetadata] = useState<{
    authorName: string;
    evidence: string;
    reviewedOn: string;
    visibility: "PRIVATE" | "PUBLIC";
  }>({
    authorName: initialAuthorName,
    evidence: initialEvidence,
    reviewedOn: initialReviewedOn,
    visibility: initialVisibility,
  });
  const [previewVisible, setPreviewVisible] = useState(false);
  const save = useSaveReflection(sessionId, reflection?.reflectionId);
  const start = useStartInterview();
  const workflowTarget = reflection
    ? resolveReflectionWorkflowTarget(reflection)
    : undefined;
  const workflowLabel = workflowTarget
    ? {
        discuss: c.resumeDiscuss,
        guide: c.resumeGuide,
        interview: c.resumeInterview,
        refine: c.resumeRefine,
      }[workflowTarget.kind]
    : c.startInterview;
  const hasUnsavedChanges = hasReflectionDraftChanges(
    { content, evidence, visibility },
    {
      content: initialContent,
      evidence: persistedMetadata.evidence,
      visibility: persistedMetadata.visibility,
    },
  ) || authorName !== persistedMetadata.authorName ||
    reviewedOn !== persistedMetadata.reviewedOn;
  const continueWorkflow = () => {
    if (!reflection) return;
    if (workflowTarget) {
      onWorkflow(workflowTarget);
      return;
    }
    start.mutate(reflection.reflectionId, {
      onSuccess: (value) =>
        onWorkflow({ id: value.interviewId, kind: "interview" }),
    });
  };
  return (
    <Screen layout="edge" testID="reflection-screen">
      <EditorialHeader backLabel={c.backToReflection} onBack={onBack} page title={c.reflection} />
      <View
        accessibilityLabel={`${c.currentBook}: ${bookTitle}${bookAuthor ? `, ${bookAuthor}` : ""}`}
        accessible
        style={styles.bookContext}
        testID="reflection-current-book"
      >
        <AppText variant="label">{c.currentBook}</AppText>
        <AppText>{bookTitle}{bookAuthor ? ` · ${bookAuthor}` : ""}</AppText>
      </View>
      <ReflectionLoopProgress
        c={c}
        disabled={hasUnsavedChanges || save.isPending}
        loading={start.isPending}
        onContinue={continueWorkflow}
        onOpenStage={(target) => {
          if (target.kind === "reflection") {
            onTimelineSurface(null);
            return;
          }
          onWorkflow(target);
        }}
        reflection={reflection}
      />
      {!timelineSurface ? <Surface variant="section">
        <TextField
          label={c.reflection}
          multiline
          onChangeText={setContent}
          value={content}
        />
        <Button
          accessibilityState={{ expanded: previewVisible }}
          onPress={() => setPreviewVisible((visible) => !visible)}
          variant="outline"
        >
          {previewVisible ? c.hidePreview : c.showPreview}
        </Button>
        {previewVisible ? (
          <View accessibilityLabel={c.markdownPreview} accessible>
            <AppText variant="heading">{c.markdownPreview}</AppText>
            <ReflectionMarkdown content={content} />
          </View>
        ) : null}
        <TextField
          label={c.evidence}
          multiline
          onChangeText={setEvidence}
          value={evidence}
        />
        <TextField
          label={c.authorName}
          maxLength={80}
          onChangeText={setAuthorName}
          value={authorName}
        />
        <TextField
          label={c.reviewDate}
          maxLength={10}
          onChangeText={setReviewedOn}
          placeholder="YYYY-MM-DD"
          value={reviewedOn}
        />
        <View style={styles.row}>
          <Button
            accessibilityState={{ selected: visibility === "PRIVATE" }}
            onPress={() => setVisibility("PRIVATE")}
            variant={visibility === "PRIVATE" ? "primary" : "outline"}
          >
            {c.private}
          </Button>
          <Button
            accessibilityState={{ selected: visibility === "PUBLIC" }}
            onPress={() => setVisibility("PUBLIC")}
            variant={visibility === "PUBLIC" ? "primary" : "outline"}
          >
            {c.public}
          </Button>
        </View>
        <Button
          disabled={!content.trim() || save.isPending || !hasUnsavedChanges}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              buildReflectionSaveInput(content, evidence, visibility, {
                ...metadata,
                authorName: authorName.trim() || undefined,
                reviewedOn: reviewedOn.trim() || undefined,
              }),
            )
          }
        >
          {c.save}
        </Button>
      </Surface> : null}
      <View style={[styles.row, styles.sectionActions]}>
        {timelineSurface ? (
          <Button
            onPress={() => {
              const hydratedMetadata = savedMetadata ?? metadata;
              if (hydratedMetadata) {
                const nextMetadata = {
                  authorName: hydratedMetadata.authorName || "",
                  evidence: hydratedMetadata.evidence || "",
                  reviewedOn: hydratedMetadata.reviewedOn || "",
                  visibility: hydratedMetadata.visibility === "PUBLIC" ? "PUBLIC" as const : "PRIVATE" as const,
                };
                setEvidence((current) =>
                  current === persistedMetadata.evidence ? nextMetadata.evidence : current,
                );
                setAuthorName((current) =>
                  current === persistedMetadata.authorName ? nextMetadata.authorName : current,
                );
                setReviewedOn((current) =>
                  current === persistedMetadata.reviewedOn ? nextMetadata.reviewedOn : current,
                );
                setVisibility((current) =>
                  current === persistedMetadata.visibility ? nextMetadata.visibility : current,
                );
                setPersistedMetadata(nextMetadata);
              }
              onTimelineSurface(null);
            }}
            variant="outline"
          >
            {c.backToReflection}
          </Button>
        ) : (
          <>
            <Button onPress={() => onTimelineSurface("notes")} variant="outline">
              {c.showSavedNotes}
            </Button>
            <Button onPress={() => onTimelineSurface("questions")} variant="outline">
              {c.showQuestions}
            </Button>
          </>
        )}
      </View>
      {timelineLoading ? <LoadingState label={c.savedNotes} /> : null}
      {timelineError ? (
        <Notice title={c.error} tone="error">
          <Button onPress={onTimelineRetry} variant="outline">{c.retry}</Button>
        </Notice>
      ) : null}
      {timelineSurface === "notes" && timeline ? <SavedNotes c={c} timeline={timeline} /> : null}
      {timelineSurface === "questions" && timeline ? (
        <QuestionWorkspace c={c} sessionId={sessionId} timeline={timeline} />
      ) : null}
      {!timelineSurface && reflection ? (
        <Button
          disabled={hasUnsavedChanges || save.isPending}
          loading={start.isPending}
          onPress={continueWorkflow}
        >
          {workflowLabel}
        </Button>
      ) : !timelineSurface ? (
        <Notice title={c.noReflection} />
      ) : null}
      {!timelineSurface && reflection && hasUnsavedChanges ? (
        <Notice title={c.saveBeforeInterview} />
      ) : null}
      {!timelineSurface && (save.isError || start.isError) ? (
        <Notice title={c.error} tone="error" />
      ) : null}
    </Screen>
  );
}

const reflectionLoopStages: ReflectionLoopStage[] = [
  "reflection",
  "interview",
  "guide",
  "discuss",
  "refine",
];

function ReflectionLoopProgress({
  c,
  disabled,
  loading,
  onContinue,
  onOpenStage,
  reflection,
}: {
  c: ReturnType<typeof reflectionCopy>;
  disabled: boolean;
  loading: boolean;
  onContinue(): void;
  onOpenStage(target: ReflectionStageTarget): void;
  reflection?: ReflectionLoop;
}) {
  const workflowTarget = reflection ? resolveReflectionWorkflowTarget(reflection) : undefined;
  const activeStage: ReflectionLoopStage = workflowTarget?.kind ?? (reflection ? "interview" : "reflection");
  const activeIndex = reflectionLoopStages.indexOf(activeStage);

  return (
    <View testID="reflection-loop-progress">
      <Surface variant="section">
        <AppText style={styles.loopDescription}>{c.loopDescription}</AppText>
      </Surface>
      {reflectionLoopStages.map((stage, index) => {
        const state = index < activeIndex ? "complete" : index === activeIndex ? "current" : "locked";
        const target = reflection
          ? resolveReflectionStageTarget(reflection, stage)
          : undefined;
        const opensEditor = stage === "reflection";
        const canContinue = state === "current" && stage === "interview" && Boolean(reflection);
        const interactive = opensEditor || Boolean(target) || canContinue;
        const stageDisabled = !opensEditor && (disabled || loading);
        const stateLabel = c.loopState[state];
        const content = (
          <>
            <AppText style={styles.loopNumber} variant="eyebrow">
              {String(index + 1).padStart(2, "0")}
            </AppText>
            <View style={styles.loopIdentity}>
              <AppText variant="heading">{c.loopStage[stage].title}</AppText>
              <AppText variant="eyebrow">{c.loopStage[stage].subtitle}</AppText>
            </View>
            <View style={styles.loopAction}>
              <AppText style={styles.loopState} variant="caption">{stateLabel}</AppText>
              {interactive ? <AppText variant="heading">›</AppText> : null}
            </View>
          </>
        );

        return interactive ? (
          <Pressable
            accessibilityLabel={`${c.loopStage[stage].title}, ${stateLabel}`}
            accessibilityHint={c.openLoopStage}
            accessibilityRole="button"
            accessibilityState={{
              busy: loading,
              disabled: stageDisabled,
              selected: state === "current",
            }}
            disabled={stageDisabled}
            key={stage}
            onPress={() => {
              if (target) onOpenStage(target);
              else if (opensEditor) onOpenStage({ kind: "reflection" });
              else onContinue();
            }}
            style={({ pressed }) => [
              styles.loopRow,
              state === "current" && styles.loopCurrent,
              pressed && styles.loopPressed,
              stageDisabled && styles.loopDisabled,
            ]}
            testID={`reflection-loop-step-${stage}`}
          >
            {content}
          </Pressable>
        ) : (
          <View
            accessibilityLabel={`${c.loopStage[stage].title}, ${stateLabel}`}
            accessibilityState={{ disabled: true, selected: state === "current" }}
            accessible
            key={stage}
            style={[styles.loopRow, state === "current" && styles.loopCurrent]}
            testID={`reflection-loop-step-${stage}`}
          >
            {content}
          </View>
        );
      })}
    </View>
  );
}

function SavedNotes({
  c,
  timeline,
}: {
  c: ReturnType<typeof reflectionCopy>;
  timeline: NonNullable<ReturnType<typeof useReflectionTimeline>["data"]>;
}) {
  return (
    <Surface variant="section">
      <AppText variant="heading">{c.savedNotes}</AppText>
      {timeline.insights.length ? (
        timeline.insights.map((insight) => (
          <View key={insight.insightId} style={styles.question}>
            <AppText variant="caption">
              {insight.authorName || insight.insightType}
              {insight.reviewedOn ? ` · ${insight.reviewedOn}` : ""}
              {insight.visibility ? ` · ${insight.visibility}` : ""}
            </AppText>
            <ReflectionMarkdown content={insight.content} />
            {insight.evidence ? <AppText>{c.evidence}: {insight.evidence}</AppText> : null}
          </View>
        ))
      ) : (
        <AppText>{c.emptySavedNotes}</AppText>
      )}
    </Surface>
  );
}

function QuestionWorkspace({
  c,
  sessionId,
  timeline,
}: {
  c: ReturnType<typeof reflectionCopy>;
  sessionId: number;
  timeline?: ReturnType<typeof useReflectionTimeline>["data"];
}) {
  const window = timeline?.windows.find(
    (item) => item.windowType === "question",
  );
  const createWindow = useCreateQuestionWindow(sessionId);
  const generate = useGenerateQuestions(sessionId, window?.windowId);
  const saveAnswer = useSaveAnswer(sessionId);
  const [focus, setFocus] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  return (
    <Surface variant="section">
      <AppText variant="heading">{c.questions}</AppText>
      {window ? (
        <>
          <TextField label={c.focus} onChangeText={setFocus} value={focus} />
          <Button
            loading={generate.isPending}
            onPress={() => {
              if (timeline) generate.mutate(buildBookQuestionFocus(timeline, focus));
            }}
            variant="outline"
          >
            {c.generate}
          </Button>
          {generate.isError ? <Notice title={c.error} tone="error" /> : null}
          {timeline?.questions
            .filter((question) => question.windowId === window.windowId)
            .map((question) => (
              <View key={question.questionId} style={styles.question}>
                <AppText>{question.questionText}</AppText>
                <TextField
                  label={c.answer}
                  multiline
                  onChangeText={(value) =>
                    setDrafts((current) => ({
                      ...current,
                      [question.questionId]: value,
                    }))
                  }
                  value={drafts[question.questionId] ?? ""}
                />
                <Button
                  disabled={!drafts[question.questionId]?.trim()}
                  loading={
                    saveAnswer.isPending &&
                    saveAnswer.variables?.questionId === question.questionId
                  }
                  onPress={() => {
                    const submitted = drafts[question.questionId].trim();
                    saveAnswer.mutate(
                      {
                        content: submitted,
                        questionId: question.questionId,
                      },
                      {
                        onSuccess: () => setDrafts((current) =>
                          current[question.questionId]?.trim() === submitted
                            ? { ...current, [question.questionId]: "" }
                            : current),
                      },
                    );
                  }}
                >
                  {c.answer}
                </Button>
                {saveAnswer.isError &&
                saveAnswer.variables?.questionId === question.questionId ? (
                  <Notice title={c.error} tone="error" />
                ) : null}
              </View>
            ))}
        </>
      ) : (
        <Button
          loading={createWindow.isPending}
          onPress={() => createWindow.mutate()}
          variant="outline"
        >
          {c.createWindow}
        </Button>
      )}
      {createWindow.isError ? <Notice title={c.error} tone="error" /> : null}
    </Surface>
  );
}

export function InterviewScreen({
  bookId,
  interviewId,
  onBack,
  onGuide,
  onInterview,
  onDone,
  onSourceRevision,
  sessionId,
}: {
  bookId: number;
  interviewId: number;
  onBack?(): void;
  onGuide(id: number): void;
  onInterview?(id: number): void;
  onDone?(): void;
  onSourceRevision?(revisionId: number): void;
  sessionId: number;
}) {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const interview = useInterview(interviewId);
  const timeline = useReflectionTimeline(sessionId);
  const response = useInterviewResponse(interviewId);
  const updateAnswer = useUpdateInterviewAnswer(interviewId);
  const next = useContinueInterview(interviewId);
  const complete = useCompleteInterview(interviewId);
  const guide = useCreateGuide(interviewId);
  const [answer, setAnswer] = useState("");
  const [brief, setBrief] = useState<GuideBrief>(defaultGuideBrief);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [answerEdit, setAnswerEdit] = useState("");
  const pageHeader = (page = false, backAction = onBack) => (
    <EditorialHeader
      backLabel={c.backToReflection}
      onBack={backAction}
      page={page}
      title={c.interview}
    />
  );
  if (interview.isLoading || timeline.isLoading)
    return (
      <Screen scroll={false}>
        {pageHeader()}
        <LoadingState label={c.interview} />
      </Screen>
    );
  const queryErrors = [
    interview.isError ? interview.error : undefined,
    timeline.isError ? timeline.error : undefined,
  ].filter((error) => error !== undefined);
  if (queryErrors.length) {
    const notFound = queryErrors.every(
      (error) => error instanceof ApiRequestError && error.status === 404,
    );
    return (
      <Screen>
        {pageHeader()}
        <Notice title={notFound ? c.notFound : c.error} tone="error">
          {!notFound ? (
            <Button
              onPress={() => {
                void interview.refetch();
                void timeline.refetch();
              }}
              testID="interview-load-retry"
              variant="outline"
            >
              {c.retry}
            </Button>
          ) : null}
        </Notice>
      </Screen>
    );
  }
  const ownsInterview = ownsInterviewRoute(
    timeline.data,
    bookId,
    interview.data?.reflectionId,
    sessionId,
  );
  if (!ownsInterview || !interview.data)
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  if (interview.data.status === "COMPLETED") {
    return (
      <Screen>
        {pageHeader(false, onDone ?? onBack)}
        <Notice title={c.interviewCompleted} tone="success" />
        {onDone ? <Button onPress={onDone}>{c.backToReflection}</Button> : null}
      </Screen>
    );
  }
  const question = interview.data.currentQuestion;
  const createGuide = () =>
    guide.mutate(brief, { onSuccess: (value) => onGuide(value.guideId) });
  const submit = (mode: "ANSWER" | "BOOK_ONLY" | "SKIP") => {
    if (!question) return;
    const submitted = answer.trim();
    response.mutate(
      {
        content: mode === "ANSWER" ? submitted : undefined,
        mode,
        questionId: question.questionId,
      },
      {
        onSuccess: () => setAnswer((current) =>
          mode !== "ANSWER" || current.trim() === submitted ? "" : current),
      },
    );
  };
  return (
    <Screen layout="edge" testID="reflection-interview-screen">
      {pageHeader(true)}
      <InterviewProgress c={c} interview={interview.data} />
      {interview.data.answers.length ? (
        <>
          <Surface variant="section">
            <Button
              accessibilityState={{ expanded: historyVisible }}
              onPress={() => setHistoryVisible((visible) => !visible)}
              variant="ghost"
            >
              {historyVisible ? c.answerHistoryHide : `${c.answerHistory} · ${interview.data.answers.length}`}
            </Button>
          </Surface>
          {historyVisible ? (
            <Surface variant="section">
              <AppText variant="heading">{c.answerHistory}</AppText>
              <AppText variant="caption">{c.answerHistoryDescription}</AppText>
            {interview.data.answers.map((savedAnswer) => {
                const editing = editingQuestionId === savedAnswer.questionId;
                return (
                  <View key={savedAnswer.answerRevisionId} style={styles.question}>
                <AppText variant="caption">{savedAnswer.question}</AppText>
                {editing ? (
                  <>
                    <TextField
                      label={`${savedAnswer.question} ${c.editAnswer}`}
                      multiline
                      onChangeText={setAnswerEdit}
                      value={answerEdit}
                    />
                    <Button
                      disabled={!answerEdit.trim() || updateAnswer.isPending}
                      loading={
                        updateAnswer.isPending &&
                        updateAnswer.variables?.revisionKind === "WORDING_ONLY"
                      }
                      onPress={() =>
                        updateAnswer.mutate(
                          {
                            content: answerEdit.trim(),
                            expectedAnswerVersion: savedAnswer.version,
                            questionId: savedAnswer.questionId,
                            revisionKind: "WORDING_ONLY",
                          },
                          {
                            onSuccess: () => setEditingQuestionId(null),
                          },
                        )
                      }
                    >
                      {c.wordingOnly}
                    </Button>
                    <Button
                      disabled={!answerEdit.trim() || updateAnswer.isPending}
                      loading={
                        updateAnswer.isPending &&
                        updateAnswer.variables?.revisionKind === "RESTART_FROM_HERE"
                      }
                      onPress={() =>
                        updateAnswer.mutate(
                          {
                            content: answerEdit.trim(),
                            expectedAnswerVersion: savedAnswer.version,
                            questionId: savedAnswer.questionId,
                            revisionKind: "RESTART_FROM_HERE",
                          },
                          {
                            onSuccess: (nextInterview) => {
                              setEditingQuestionId(null);
                              if (nextInterview.interviewId !== interviewId) {
                                onInterview?.(nextInterview.interviewId);
                              }
                            },
                          },
                        )
                      }
                      variant="outline"
                    >
                      {c.restartFromHere}
                    </Button>
                    <Button
                      onPress={() => setEditingQuestionId(null)}
                      variant="ghost"
                    >
                      {c.cancel}
                    </Button>
                  </>
                ) : (
                  <>
                    <AppText>{savedAnswer.content}</AppText>
                    <Button
                      accessibilityLabel={`${savedAnswer.question} ${c.editAnswer}`}
                      onPress={() => {
                        setEditingQuestionId(savedAnswer.questionId);
                        setAnswerEdit(savedAnswer.content);
                      }}
                      variant="outline"
                    >
                      {c.editAnswer}
                    </Button>
                  </>
                )}
                  </View>
                );
              })}
              {updateAnswer.isError ? <Notice title={c.error} tone="error" /> : null}
            </Surface>
          ) : null}
        </>
      ) : null}
      {question ? (
        <Surface style={styles.questionDeck} tone="dark" variant="section">
          <AppText style={styles.questionDeckTitle} variant="heading">{question.question}</AppText>
          <AppText style={styles.questionDeckMeta} variant="caption">
            {question.coverageArea} · {question.sensitivity}
          </AppText>
          {question.sourceExcerpt ? (
            <View accessibilityLabel={c.sourceDetails} style={styles.sourceExcerpt}>
              <AppText numberOfLines={3} style={styles.questionDeckText}>“{question.sourceExcerpt}”</AppText>
              <AppText style={styles.questionDeckMeta} variant="caption">
                {question.sourceType}
                {question.sourceVersion ? ` · ${question.sourceVersion}` : ""}
                {question.sourceRefId ? ` · #${question.sourceRefId}` : ""}
                {` · ${c.sourceRevision} #${interview.data.sourceRevisionId}`}
              </AppText>
              {onSourceRevision ? (
                <Button
                  accessibilityLabel={`${c.openSourceRevision} #${interview.data.sourceRevisionId}`}
                  onPress={() => onSourceRevision(interview.data.sourceRevisionId)}
                  variant="inverseGhost"
                >
                  {c.openSourceRevision} #{interview.data.sourceRevisionId}
                </Button>
              ) : null}
            </View>
          ) : null}
          <TextField
            label={c.answer}
            multiline
            onChangeText={setAnswer}
            testID="interview-answer-input"
            tone="dark"
            value={answer}
          />
          <Button
            disabled={!answer.trim() || response.isPending || complete.isPending}
            loading={response.isPending}
            onPress={() => submit("ANSWER")}
            testID="interview-answer-submit"
            variant="inverse"
          >
            {c.saveInterviewAnswer}
          </Button>
          <View style={styles.row}>
            <Button
              disabled={response.isPending}
              onPress={() => submit("BOOK_ONLY")}
              testID="interview-book-only-submit"
              variant="inverse"
            >
              {c.bookOnly}
            </Button>
            <Button
              disabled={response.isPending}
              onPress={() => submit("SKIP")}
              testID="interview-skip-submit"
              variant="inverseGhost"
            >
              {interview.data.maxReached &&
              interview.data.answeredCount < interview.data.minimumAnswers &&
              interview.data.skippedCount > 0
                ? c.reopenSkippedAction
                : c.skip}
            </Button>
          </View>
          {response.isError ? <Notice title={c.error} tone="error" /> : null}
        </Surface>
      ) : null}
      {interview.data.canGenerateGuide ? (
        <GuideBriefFields brief={brief} c={c} onChange={setBrief} />
      ) : null}
      {guide.isError ? (
        <Surface variant="section">
          <Notice title={c.guideGenerationFailed} tone="error" />
          <Button
            disabled={guide.isPending}
            loading={guide.isPending}
            onPress={createGuide}
            variant="outline"
          >
            {c.retrySameBrief}
          </Button>
        </Surface>
      ) : null}
      {!guide.isError ? (
        <Button
          disabled={!interview.data.canGenerateGuide}
          loading={guide.isPending}
          onPress={createGuide}
          testID="interview-create-guide"
        >
          {c.createGuide}
        </Button>
      ) : null}
      {!question && !interview.data.maxReached && !interview.data.guideId ? (
        <>
          <Button
            loading={next.isPending}
            onPress={() => next.mutate()}
            testID="interview-continue"
          >
            {c.continueInterview}
          </Button>
          {next.isError ? <Notice title={c.error} tone="error" /> : null}
        </>
      ) : null}
      {!question && interview.data.maxReached ? (
        <Notice title={c.maxQuestions}>
          {interview.data.skippedCount > 0 ? <AppText>{c.reopenSkipped}</AppText> : null}
        </Notice>
      ) : null}
      {interview.data.maxReached &&
      interview.data.answeredCount < interview.data.minimumAnswers ? (
        <Button
          disabled={response.isPending || complete.isPending}
          loading={complete.isPending}
          onPress={() => complete.mutate(undefined, { onSuccess: onDone })}
          testID="interview-complete"
          variant="outline"
        >
          {c.endInterview}
        </Button>
      ) : null}
      {complete.isError ? <Notice title={c.error} tone="error" /> : null}
    </Screen>
  );
}

function InterviewProgress({
  c,
  interview,
}: {
  c: ReturnType<typeof reflectionCopy>;
  interview: NonNullable<ReturnType<typeof useInterview>["data"]>;
}) {
  const progress = Math.min(
    100,
    Math.max(0, (interview.answeredCount / Math.max(1, interview.targetAnswers)) * 100),
  );
  const label = `${c.interviewProgress.label}: ${interview.answeredCount} / ${c.interviewProgress.target} ${interview.targetAnswers}`;

  return (
    <Surface accessibilityLabel={label} testID="interview-progress" variant="section">
      <View style={styles.interviewProgressHeading}>
        <AppText variant="eyebrow">{c.interviewProgress.label}</AppText>
        <AppText variant="heading">
          {interview.answeredCount} / {c.interviewProgress.target} {interview.targetAnswers}
        </AppText>
      </View>
      <View accessibilityElementsHidden style={styles.interviewProgressTrack}>
        <View style={[styles.interviewProgressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.interviewProgressFacts}>
        <AppText style={styles.interviewProgressFact} variant="caption">
          {c.interviewProgress.minimum} {interview.minimumAnswers}
        </AppText>
        <AppText style={styles.interviewProgressFact} variant="caption">
          {c.interviewProgress.generated} {interview.generatedCount}/{interview.maximumQuestions}
        </AppText>
        <AppText style={styles.interviewProgressFact} variant="caption">
          {c.interviewProgress.skipped} {interview.skippedCount}
        </AppText>
      </View>
    </Surface>
  );
}

function GuideBriefFields({
  brief,
  c,
  onChange,
}: {
  brief: GuideBrief;
  c: ReturnType<typeof reflectionCopy>;
  onChange(value: GuideBrief): void;
}) {
  const { locale } = useI18n();
  const labels = reflectionLabels(locale);
  const [advanced, setAdvanced] = useState(false);
  const choices = [
    {
      key: "facilitationLevel",
      label: c.facilitationLevel,
      options: ["BEGINNER", "EXPERIENCED", "EXPERT"] as const,
      text: labels.facilitation,
    },
    {
      key: "purpose",
      label: c.guidePurpose,
      options: ["THOUGHT_EXPANSION", "ISSUE_EXPLORATION", "DISCUSSION_PREP"] as const,
      text: labels.purpose,
    },
    {
      key: "audienceMode",
      label: c.audienceMode,
      options: ["SMALL_GROUP", "SELF_AI"] as const,
      text: labels.audience,
    },
    {
      key: "targetMinutes",
      label: c.targetMinutes,
      options: [20, 40, 60] as const,
      text: labels.targetMinutes,
    },
    {
      key: "disclosureMode",
      label: c.disclosureMode,
      options: ["PRIVATE_CONTEXT", "REFLECTION_ONLY"] as const,
      text: labels.disclosure,
    },
  ] as const;
  return (
    <Surface variant="section">
      <AppText variant="heading">{c.guideBrief}</AppText>
      <AppText variant="caption">{c.guideBriefDescription}</AppText>
      {brief.audienceMode === "SMALL_GROUP" ? (
        <Notice title={c.smallGroupExplanation} />
      ) : null}
      <Button
        accessibilityState={{ expanded: advanced }}
        onPress={() => setAdvanced((visible) => !visible)}
        variant="outline"
      >
        {advanced ? c.guideBriefCollapse : c.guideBriefAdvanced}
      </Button>
      {advanced ? choices.map((choice) => (
        <View key={choice.key} style={styles.question}>
          <AppText>{choice.label}</AppText>
          <View style={styles.row}>
            {choice.options.map((option) => {
              const selected = brief[choice.key] === option;
              return (
                <Button
                  accessibilityState={{ selected }}
                  key={String(option)}
                  onPress={() => onChange({ ...brief, [choice.key]: option })}
                  variant={selected ? "primary" : "outline"}
                >
                  {(choice.text as Record<string | number, string>)[option]}
                </Button>
              );
            })}
          </View>
        </View>
      )) : null}
    </Surface>
  );
}

export { GuideScreen } from "./guide-screen";

export function DiscussionScreen({
  bookId,
  onBack,
  onRefine,
  personaNames = {},
  runId,
}: {
  bookId: number;
  onBack?(): void;
  onRefine(id: number): void;
  personaNames?: Readonly<Record<number, string>>;
  runId: number;
}) {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const labels = reflectionLabels(locale);
  const run = useRun(runId);
  const guide = useGuide(run.data?.guideId ?? 0);
  const timeline = useReflectionTimeline(run.data?.sessionId ?? 0);
  const turn = useDiscussionTurn(runId, run.data?.sessionId);
  const [draft, setDraft] = useState("");
  const [composerFocusVersion, setComposerFocusVersion] = useState(0);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const [optimisticMessage, setOptimisticMessage] = useState<{
    content: string;
    persistedIds: ReadonlySet<number>;
  } | null>(null);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const pageHeader = (page = false) => (
    <EditorialHeader
      backLabel={c.backToReflection}
      onBack={onBack}
      page={page}
      title={c.discuss}
    />
  );
  if (run.isLoading) return (
    <Screen scroll={false}>
      {pageHeader()}
      <LoadingState label={c.discuss} />
    </Screen>
  );
  if (run.isError) {
    const notFound =
      run.error instanceof ApiRequestError && run.error.status === 404;
    return (
      <Screen>
        {pageHeader()}
        <Notice title={notFound ? c.notFound : c.error} tone="error">
          {!notFound ? (
            <Button onPress={() => void run.refetch()} variant="outline">
              {c.retry}
            </Button>
          ) : null}
        </Notice>
      </Screen>
    );
  }
  if (!run.data)
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  if (guide.isLoading) return (
    <Screen scroll={false}>
      {pageHeader()}
      <LoadingState label={c.discuss} />
    </Screen>
  );
  if (guide.isError) {
    const notFound =
      guide.error instanceof ApiRequestError && guide.error.status === 404;
    return (
      <Screen>
        {pageHeader()}
        <Notice title={notFound ? c.notFound : c.error} tone="error">
          {!notFound ? (
            <Button onPress={() => void guide.refetch()} variant="outline">
              {c.retry}
            </Button>
          ) : null}
        </Notice>
      </Screen>
    );
  }
  if (!guide.data)
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  if (timeline.isLoading) return (
    <Screen scroll={false}>
      {pageHeader()}
      <LoadingState label={c.discuss} />
    </Screen>
  );
  if (timeline.isError) {
    const notFound =
      timeline.error instanceof ApiRequestError && timeline.error.status === 404;
    return (
      <Screen>
        {pageHeader()}
        <Notice title={notFound ? c.notFound : c.error} tone="error">
          {!notFound ? (
            <Button onPress={() => void timeline.refetch()} variant="outline">
              {c.retry}
            </Button>
          ) : null}
        </Notice>
      </Screen>
    );
  }
  if (
    !timeline.data ||
    !ownsReflectionRoute(timeline.data, bookId, run.data.sessionId)
  )
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  if (run.data.status === "COMPLETED")
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.resumeRefine} tone="success" />
        <Button onPress={() => onRefine(runId)}>{c.refine}</Button>
      </Screen>
    );
  const moderationEvents = timeline.data.moderationEvents.filter(
    (event) =>
      event.windowId === run.data.windowId && event.decision !== "ALLOW",
  );
  const persistedMessages = timeline.data.messages.filter(
    (message) => message.windowId === run.data.windowId,
  );
  const perspectiveNames = new Map<number, string>(
    Object.entries(personaNames).map(([personaId, displayName]) => [
      Number(personaId),
      displayName,
    ]),
  );
  (run.data.perspectiveCandidates ?? []).forEach((candidate) => {
    if (!perspectiveNames.has(candidate.personaId)) {
      perspectiveNames.set(candidate.personaId, candidate.displayName);
    }
  });
  const optimisticPersisted = optimisticMessage
    ? persistedMessages.some(
        (message) =>
          message.role === "user" &&
          message.content === optimisticMessage.content &&
          !optimisticMessage.persistedIds.has(message.messageId),
      )
    : false;
  const sendTurn = (
    content: string,
    navigation: "RESPOND" | "NEXT" | "FINISH",
    onSuccess?: (result: GuidedTurn) => void,
  ) => {
    setOptimisticMessage({
      content,
      persistedIds: new Set(persistedMessages.map((message) => message.messageId)),
    });
    setAwaitingReply(true);
    turn.mutate(buildDiscussionTurn(content, navigation), {
      onError: () => {
        setOptimisticMessage(null);
        setAwaitingReply(false);
      },
      onSuccess: (result) => {
        if (result.moderation && result.moderation.decision !== "ALLOW") {
          setOptimisticMessage(null);
          setAwaitingReply(false);
        } else {
          setAwaitingReply(false);
          setComposerFocusVersion((version) => version + 1);
        }
        onSuccess?.(result);
      },
    });
  };
  const confirmFinish = () => {
    const submittedDraft = draft;
    const note = submittedDraft.trim();
    if (!note || turn.isPending) return;
    Alert.alert(c.confirmFinish, c.finishDescription, [
      { style: "cancel", text: c.cancel },
      {
        onPress: () =>
          sendTurn(note, "FINISH", (result) => {
            if (shouldClearDiscussionDraft(result)) {
              setDraft((current) => current === submittedDraft ? "" : current);
            }
            if (result.runStatus === "COMPLETED") onRefine(runId);
          }),
        text: c.confirmFinishAction,
      },
    ]);
  };
  return (
    <Screen layout="edge" scroll={false} testID="reflection-discussion-screen">
      {pageHeader(true)}
      {run.data.currentItem ? (
        <Surface
          style={styles.currentTopic}
          testID="discussion-sticky-context"
          variant="section"
        >
          <GuideStageProgress
            currentStage={run.data.currentItem.stage}
            locale={locale}
          />
          <View style={styles.currentTopicMeta} testID="discussion-current-topic-meta">
            <AppText style={styles.currentTopicTag} variant="caption">
              {labels.stage[run.data.currentItem.stage as keyof typeof labels.stage] ??
                run.data.currentItem.stage} · {run.data.currentItem.expectedMinutes}
              {locale === "ko" ? "분" : " min"}
            </AppText>
            <AppText style={styles.currentTopicTag} variant="caption">
              {String(run.data.currentItem.order).padStart(2, "0")} / {String(
                guide.data.items.length,
              ).padStart(2, "0")} {locale === "ko" ? "주제" : "topics"}
            </AppText>
          </View>
          <AppText variant="heading">{run.data.currentItem.question}</AppText>
          {run.data.currentItem.sourceExcerpt ? (
            <View>
              <Button
                accessibilityState={{ expanded: sourceExpanded }}
                onPress={() => setSourceExpanded((expanded) => !expanded)}
                variant="ghost"
              >
                {c.sourceDetails}
              </Button>
              {sourceExpanded ? (
                <AppText>{run.data.currentItem.sourceExcerpt}</AppText>
              ) : null}
            </View>
          ) : null}
        </Surface>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.discussionScrollContent}
        keyboardShouldPersistTaps="handled"
        style={styles.discussionScroll}
        testID="discussion-history-scroll"
      >
      <Notice title={c.discussionRevisionBoundary} />
      {persistedMessages.map((message) => {
        const timestamp = formatMessageTimestamp(message.createdAt, locale);
        const speaker = message.role === "user"
          ? c.you
          : message.personaId != null
            ? perspectiveNames.get(message.personaId) ?? `${c.perspective} #${message.personaId}`
            : c.assistant;
        return (
          <Surface
            key={message.messageId}
            style={message.role === "user" ? styles.userMessage : styles.assistantMessage}
          >
            <AppText variant="caption">{speaker}</AppText>
            {timestamp ? (
              <AppText
                accessibilityLabel={message.createdAt ?? undefined}
                testID={`discussion-message-time-${message.messageId}`}
                variant="caption"
              >
                {timestamp}
              </AppText>
            ) : null}
            <AppText>{message.content}</AppText>
          </Surface>
        );
      })}
      {optimisticMessage && !optimisticPersisted ? (
        <Surface style={styles.userMessage}>
          <AppText variant="caption">{c.you} · {c.sending}</AppText>
          <AppText>{optimisticMessage.content}</AppText>
        </Surface>
      ) : null}
      {awaitingReply && !optimisticPersisted ? <Notice title={c.pendingReply} /> : null}
      {moderationEvents.map((event) => (
        <Notice
          key={event.eventId}
          title={
            event.suggestedQuestion ||
            (event.decision === "REDIRECT"
              ? c.moderationRedirect
              : c.moderationReject)
          }
        />
      ))}
      {run.data.perspectiveSelectionRequired ? (
        <Surface variant="section">
          <Notice title={c.choosePerspective} />
          {run.data.perspectiveCandidates?.map((candidate) => (
            <Button
              accessibilityLabel={`${c.choosePerspective}: ${candidate.displayName}`}
              key={candidate.personaId}
              loading={turn.isPending}
              onPress={() =>
                turn.mutate(
                  buildDiscussionTurn("", "SELECT_PERSPECTIVE", candidate.personaId),
                )
              }
              variant="outline"
            >
              {candidate.displayName}
            </Button>
          ))}
          <Button
            loading={turn.isPending}
            onPress={() =>
              turn.mutate(buildDiscussionTurn("", "SKIP_PERSPECTIVE"))
            }
            variant="ghost"
          >
            {c.skipPerspective}
          </Button>
        </Surface>
      ) : (
        <>
          <Surface variant="section">
            <TextField
              autoFocus={composerFocusVersion > 0}
              key={`discussion-composer-${composerFocusVersion}`}
              label={c.answer}
              multiline
              onChangeText={setDraft}
              value={draft}
            />
            <View style={styles.row}>
              <Button
                disabled={!draft.trim()}
                loading={turn.isPending}
                onPress={() => {
                  const submittedDraft = draft;
                  sendTurn(submittedDraft.trim(), "RESPOND", (result) => {
                    if (shouldClearDiscussionDraft(result)) {
                      setDraft((current) => current === submittedDraft ? "" : current);
                    }
                  });
                }}
              >
                {c.sendDiscussionAnswer}
              </Button>
              <Button
                disabled={!draft.trim()}
                loading={turn.isPending}
                onPress={() => {
                  const submittedDraft = draft;
                  sendTurn(submittedDraft.trim(), "NEXT", (result) => {
                    if (shouldClearDiscussionDraft(result)) {
                      setDraft((current) => current === submittedDraft ? "" : current);
                    }
                  });
                }}
                variant="outline"
              >
                {c.saveAndNextTopic}
              </Button>
            </View>
          </Surface>
        </>
      )}
      <View style={styles.sectionActions}>
        <Button
          disabled={run.data.perspectiveSelectionRequired || !draft.trim()}
          loading={turn.isPending && turn.variables?.navigation === "FINISH"}
          onPress={confirmFinish}
        >
          {c.finishAndRefine}
        </Button>
      </View>
      {turn.isError ? (
        <Notice title={c.error} tone="error" />
      ) : null}
      </ScrollView>
    </Screen>
  );
}

function GuideStageProgress({
  currentStage,
  locale,
}: {
  currentStage: string;
  locale: "en" | "ko";
}) {
  const labels = reflectionLabels(locale);
  return (
    <View accessibilityLabel={reflectionCopy(locale).guideStages} style={styles.stageRow}>
      {guideStages.map((stage, index) => (
        <View key={stage} style={styles.stage}>
          <AppText variant="caption">
            {index + 1}. {labels.stage[stage]}
            {stage === currentStage ? ` · ${reflectionCopy(locale).current}` : ""}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function RefinementScreen({
  bookId,
  onBack,
  onDone,
  runId,
}: {
  bookId: number;
  onBack?(): void;
  onDone(): void;
  runId: number;
}) {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const run = useRun(runId);
  const timeline = useReflectionTimeline(run.data?.sessionId ?? 0);
  const refinement = useRefinement(runId);
  const pageHeader = (page = false) => (
    <EditorialHeader
      backLabel={c.backToReflection}
      description={page ? c.refineDescription : undefined}
      onBack={onBack}
      page={page}
      title={c.refine}
    />
  );
  if (refinement.isLoading || run.isLoading || (run.data && timeline.isLoading))
    return (
      <Screen scroll={false}>
        {pageHeader()}
        <LoadingState label={c.refine} />
      </Screen>
    );
  const failedQueries = [refinement, run, timeline].filter(
    (query) => query.isError,
  );
  if (failedQueries.length) {
    const notFound = failedQueries.every(
      (query) =>
        query.error instanceof ApiRequestError && query.error.status === 404,
    );
    return (
      <Screen>
        {pageHeader()}
        <Notice title={notFound ? c.notFound : c.error} tone="error">
          {!notFound ? (
            <Button
              onPress={() =>
                failedQueries.forEach((query) => void query.refetch())
              }
              variant="outline"
            >
              {c.retry}
            </Button>
          ) : null}
        </Notice>
      </Screen>
    );
  }
  if (
    !refinement.data ||
    !run.data ||
    !ownsReflectionRoute(timeline.data, bookId, run.data.sessionId)
  )
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  return (
    <RefinementEditor
      c={c}
      key={refinement.data.runId}
      onBack={onBack}
      onDone={onDone}
      refinement={refinement.data}
      runId={runId}
    />
  );
}

function RefinementEditor({
  c,
  onBack,
  onDone,
  refinement,
  runId,
}: {
  c: ReturnType<typeof reflectionCopy>;
  onBack?(): void;
  onDone(): void;
  refinement: NonNullable<ReturnType<typeof useRefinement>["data"]>;
  runId: number;
}) {
  const save = useSaveRefinement(runId);
  const [draft, setDraft] = useState(refinement.currentContent);
  const [draftBeforeSuggestion, setDraftBeforeSuggestion] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Exclude<RefinementOutcome, "KEPT">>("DEEPENED");
  const mode = refinementSaveMode(
    draft,
    refinement.currentContent,
    refinement.suggestedContent,
  );
  return (
    <Screen layout="edge" testID="reflection-refinement-screen">
      <EditorialHeader
        backLabel={c.backToReflection}
        description={c.refineDescription}
        onBack={onBack}
        page
        title={c.refine}
      />
      <Surface variant="section">
        <AppText variant="heading">{c.refineInitial}</AppText>
        <AppText>{refinement.initialContent}</AppText>
      </Surface>
      <Surface style={styles.refinePerspective} variant="section">
        <AppText variant="heading">{c.refinePerspective}</AppText>
        <AppText variant="caption">{c.private}</AppText>
        <AppText>{refinement.perspectiveSummary}</AppText>
      </Surface>
      <Surface variant="section">
        {refinement.suggestionStatus === "PENDING" ? (
          <Notice title={c.suggestionPending} />
        ) : null}
        {refinement.suggestionStatus === "READY" &&
        refinement.suggestedContent ? (
          <>
            <AppText variant="heading">{c.suggestion}</AppText>
            <AppText variant="caption">{c.suggestionBoundary}</AppText>
            <AppText>{refinement.suggestedContent}</AppText>
            <Button
              onPress={() => {
                const suggestion = refinement.suggestedContent ?? draft;
                if (draft !== suggestion) setDraftBeforeSuggestion(draft);
                setDraft(suggestion);
              }}
              variant="outline"
            >
              {c.insertSuggestion}
            </Button>
            {draftBeforeSuggestion !== null ? (
              <Button
                onPress={() => {
                  setDraft(draftBeforeSuggestion);
                  setDraftBeforeSuggestion(null);
                }}
                variant="ghost"
              >
                {c.undoSuggestion}
              </Button>
            ) : null}
          </>
        ) : null}
        {refinement.suggestionStatus === "FAILED" ? (
          <Notice title={c.suggestionFailed} />
        ) : null}
      </Surface>
      <Surface variant="section">
        <AppText variant="eyebrow">{c.refineFinal}</AppText>
        <TextField
          label={c.reflection}
          multiline
          onChangeText={setDraft}
          value={draft}
        />
        <AppText testID="refinement-draft-status" variant="caption">
          {mode ? c.refineDraftUnsaved : c.refineDraftCurrent}
        </AppText>
        <AppText variant="label">{c.refineOutcome}</AppText>
        <View style={styles.row}>
          {(["DEEPENED", "NEW_PERSPECTIVE", "CHANGED"] as const).map((value) => (
            <Button
              accessibilityState={{ selected: outcome === value }}
              key={value}
              onPress={() => setOutcome(value)}
              variant={outcome === value ? "primary" : "outline"}
            >
              {c.refineOutcomes[value]}
            </Button>
          ))}
        </View>
        {save.isError ? <Notice title={c.error} tone="error" /> : null}
        <Button
          disabled={!mode || !draft.trim()}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              {
                finalContent: draft.trim(),
                mode: mode ?? "EDITED",
                outcome,
              },
              { onSuccess: onDone },
            )
          }
        >
          {c.saveRevision}
        </Button>
        <Button
          loading={save.isPending}
          onPress={() =>
            save.mutate({ mode: "KEPT", outcome: "KEPT" }, { onSuccess: onDone })
          }
          variant="outline"
        >
          {c.keepFirstThought}
        </Button>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  assistantMessage: { alignSelf: "flex-start", marginHorizontal: spacing.x5, maxWidth: "84%" },
  bookContext: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.x1,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x3,
  },
  currentTopic: { backgroundColor: colors.surface },
  currentTopicMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  currentTopicTag: {
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1,
  },
  discussionScroll: { flex: 1 },
  discussionScrollContent: { flexGrow: 1, paddingBottom: spacing.x5 },
  question: { gap: spacing.x2 },
  questionDeck: {
    backgroundColor: colors.dark,
    borderColor: colors.darkLine,
    gap: spacing.x4,
    paddingVertical: spacing.x5,
  },
  questionDeckMeta: { color: colors.darkMuted },
  questionDeckText: { color: colors.darkText },
  questionDeckTitle: { color: colors.darkText },
  refinePerspective: { backgroundColor: colors.surface },
  loopCurrent: { backgroundColor: colors.accentSoft },
  loopAction: { alignItems: "center", flexDirection: "row", gap: spacing.x2 },
  loopDescription: { color: colors.muted },
  loopDisabled: { backgroundColor: colors.surface },
  loopIdentity: { flex: 1, gap: spacing.x1, minWidth: 0 },
  loopNumber: { width: 24 },
  loopPressed: { opacity: 0.62 },
  loopRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.x4,
    minHeight: 72,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x3,
  },
  loopState: { flexShrink: 0 },
  interviewProgressFact: {
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1,
  },
  interviewProgressFacts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.x2,
  },
  interviewProgressFill: {
    backgroundColor: colors.accent,
    height: StyleSheet.hairlineWidth,
  },
  interviewProgressHeading: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: spacing.x3,
    justifyContent: "space-between",
  },
  interviewProgressTrack: {
    backgroundColor: colors.line,
    height: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  sectionActions: { gap: spacing.x2, paddingHorizontal: spacing.x5, paddingVertical: spacing.x4 },
  sourceExcerpt: {
    borderLeftColor: colors.accent,
    borderLeftWidth: 1,
    gap: spacing.x2,
    paddingLeft: spacing.x3,
  },
  stage: { flexBasis: 120, flexGrow: 1 },
  stageRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1 },
  userMessage: { alignSelf: "flex-end", marginHorizontal: spacing.x5, maxWidth: "84%" },
});
