import type {
  DiscussionNavigation,
  GuidedTurn,
  ReflectionLoop,
  ReflectionWorkflowTarget,
  ReflectionVisibility,
  SaveReflectionInput,
} from "./types";

export type ReflectionLoopStage =
  | "reflection"
  | "interview"
  | "guide"
  | "discuss"
  | "refine";

export type ReflectionStageTarget =
  | { kind: "reflection" }
  | ReflectionWorkflowTarget;

export type ReflectionMetadata = {
  authorName?: string;
  evidence?: string;
  reviewedOn?: string;
  title?: string;
  visibility?: string;
};

export function deviceLocalDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildReflectionSaveInput(
  content: string,
  evidence: string,
  visibility: ReflectionVisibility,
  metadata?: ReflectionMetadata,
): SaveReflectionInput {
  return {
    authorName: metadata?.authorName,
    content: content.trim(),
    evidence: evidence.trim() || undefined,
    reviewedOn: metadata?.reviewedOn,
    title: metadata?.title,
    visibility,
  };
}

export function hasReflectionDraftChanges(
  draft: { content: string; evidence: string; visibility: ReflectionVisibility },
  initial: { content: string; evidence: string; visibility: ReflectionVisibility },
) {
  return (
    draft.content !== initial.content ||
    draft.evidence !== initial.evidence ||
    draft.visibility !== initial.visibility
  );
}

export function buildDiscussionTurn(
  content: string,
  navigation: DiscussionNavigation,
  personaId?: number,
) {
  return {
    content:
      navigation === "SELECT_PERSPECTIVE" || navigation === "SKIP_PERSPECTIVE"
        ? ""
        : content.trim(),
    navigation,
    personaId,
  };
}

export function buildBookQuestionFocus(
  book: { bookAuthor?: string | null; bookId: number; bookTitle: string },
  focus?: string,
) {
  const context = [
    `bookId=${book.bookId}`,
    `title=${book.bookTitle}`,
    `author=${book.bookAuthor ?? "unknown"}`,
  ].join("; ");
  return focus?.trim() ? `${context}; focus=${focus.trim()}` : context;
}

export function shouldClearDiscussionDraft(turn: GuidedTurn) {
  return !turn.moderation || turn.moderation.decision === "ALLOW";
}

export function resolveReflectionWorkflowTarget(
  reflection: ReflectionLoop,
): ReflectionWorkflowTarget | undefined {
  if (reflection.runId) {
    return {
      id: reflection.runId,
      kind: reflection.runStatus === "COMPLETED" ? "refine" : "discuss",
    };
  }
  if (reflection.guideId) return { id: reflection.guideId, kind: "guide" };
  if (reflection.activeInterviewId) {
    return { id: reflection.activeInterviewId, kind: "interview" };
  }
  return undefined;
}

export function resolveReflectionStageTarget(
  reflection: ReflectionLoop,
  stage: ReflectionLoopStage,
): ReflectionStageTarget | undefined {
  if (stage === "reflection") return { kind: "reflection" };
  if (stage === "interview" && reflection.activeInterviewId) {
    return { id: reflection.activeInterviewId, kind: "interview" };
  }
  if (stage === "guide" && reflection.guideId) {
    return { id: reflection.guideId, kind: "guide" };
  }
  if (stage === "discuss" && reflection.runId) {
    return { id: reflection.runId, kind: "discuss" };
  }
  if (
    stage === "refine" &&
    reflection.runId &&
    reflection.runStatus === "COMPLETED"
  ) {
    return { id: reflection.runId, kind: "refine" };
  }
  return undefined;
}

export function refinementSaveMode(
  draft: string,
  currentContent: string,
  suggestion?: string | null,
) {
  if (draft.trim() === currentContent.trim()) return undefined;
  return draft.trim() === suggestion?.trim()
    ? "ACCEPTED_SUGGESTION"
    : "EDITED";
}
