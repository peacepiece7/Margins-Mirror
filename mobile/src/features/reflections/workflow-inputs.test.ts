import {
  buildBookQuestionFocus,
  buildDiscussionTurn,
  buildReflectionSaveInput,
  deviceLocalDate,
  hasReflectionDraftChanges,
  refinementSaveMode,
  resolveReflectionStageTarget,
  resolveReflectionWorkflowTarget,
  shouldClearDiscussionDraft,
} from "./workflow-inputs";

describe("reflection workflow inputs", () => {
  it("formats a new review date from device-local calendar fields", () => {
    const local = new Date(2026, 0, 2, 23, 30);
    expect(deviceLocalDate(local)).toBe("2026-01-02");
  });

  // BDD: FRONT-038
  it("injects selected-book identity into generated-question focus", () => {
    expect(buildBookQuestionFocus({ bookAuthor: "Frank Herbert", bookId: 4, bookTitle: "Dune" }, "power")).toBe(
      "bookId=4; title=Dune; author=Frank Herbert; focus=power",
    );
  });
  it("preserves persisted metadata while saving edited content", () => {
    expect(
      buildReflectionSaveInput("  Revised  ", "  Citation  ", "PUBLIC", {
        authorName: "Reader",
        reviewedOn: "2026-08-24",
        title: "Custom title",
      }),
    ).toEqual({
      authorName: "Reader",
      content: "Revised",
      evidence: "Citation",
      reviewedOn: "2026-08-24",
      title: "Custom title",
      visibility: "PUBLIC",
    });
  });

  it("detects unsaved fields that must gate interview creation", () => {
    const initial = { content: "A", evidence: "B", visibility: "PRIVATE" as const };
    expect(hasReflectionDraftChanges(initial, initial)).toBe(false);
    expect(hasReflectionDraftChanges({ ...initial, evidence: "C" }, initial)).toBe(true);
  });

  it("sends nonblank NEXT content and exact perspective actions", () => {
    expect(buildDiscussionTurn("  continue  ", "NEXT")).toEqual({
      content: "continue",
      navigation: "NEXT",
      personaId: undefined,
    });
    expect(buildDiscussionTurn("ignored", "SELECT_PERSPECTIVE", 41)).toEqual({
      content: "",
      navigation: "SELECT_PERSPECTIVE",
      personaId: 41,
    });
    expect(buildDiscussionTurn("ignored", "SKIP_PERSPECTIVE")).toEqual({
      content: "",
      navigation: "SKIP_PERSPECTIVE",
      personaId: undefined,
    });
  });

  it("keeps the draft when moderation does not allow the turn", () => {
    expect(shouldClearDiscussionDraft({ moderation: null } as never)).toBe(true);
    expect(
      shouldClearDiscussionDraft({ moderation: { decision: "REJECT" } } as never),
    ).toBe(false);
    expect(
      shouldClearDiscussionDraft({ moderation: { decision: "REDIRECT" } } as never),
    ).toBe(false);
  });

  it("resumes the most advanced persisted workflow state", () => {
    const base = {
      activeInterviewId: 11,
      bookId: 3,
      currentRevision: { content: "A", revisionId: 1, version: 1 },
      guideId: 12,
      reflectionId: 1,
      revisions: [],
      runId: 13,
      sessionId: 2,
      title: "Reflection",
      visibility: "PRIVATE" as const,
    };
    expect(
      resolveReflectionWorkflowTarget({ ...base, runStatus: "ACTIVE" }),
    ).toEqual({ id: 13, kind: "discuss" });
    expect(
      resolveReflectionWorkflowTarget({ ...base, runStatus: "COMPLETED" }),
    ).toEqual({ id: 13, kind: "refine" });
    expect(
      resolveReflectionWorkflowTarget({ ...base, runId: null }),
    ).toEqual({ id: 12, kind: "guide" });
    expect(
      resolveReflectionWorkflowTarget({ ...base, guideId: null, runId: null }),
    ).toEqual({ id: 11, kind: "interview" });
  });

  // BDD: RLOOP-057, MOBILE-019
  it("opens every Reflection Loop stage only from its persisted locator", () => {
    const reflection = {
      activeInterviewId: 11,
      bookId: 3,
      currentRevision: { content: "A", revisionId: 1, version: 1 },
      guideId: 12,
      reflectionId: 1,
      revisions: [],
      runId: 13,
      runStatus: "COMPLETED" as const,
      sessionId: 2,
      title: "Reflection",
      visibility: "PRIVATE" as const,
    };

    expect(resolveReflectionStageTarget(reflection, "reflection")).toEqual({
      kind: "reflection",
    });
    expect(resolveReflectionStageTarget(reflection, "interview")).toEqual({
      id: 11,
      kind: "interview",
    });
    expect(resolveReflectionStageTarget(reflection, "guide")).toEqual({
      id: 12,
      kind: "guide",
    });
    expect(resolveReflectionStageTarget(reflection, "discuss")).toEqual({
      id: 13,
      kind: "discuss",
    });
    expect(resolveReflectionStageTarget(reflection, "refine")).toEqual({
      id: 13,
      kind: "refine",
    });
    expect(
      resolveReflectionStageTarget(
        { ...reflection, runId: null },
        "discuss",
      ),
    ).toBeUndefined();
    expect(
      resolveReflectionStageTarget(
        { ...reflection, runStatus: "ACTIVE" },
        "refine",
      ),
    ).toBeUndefined();
  });

  it("classifies direct edits, accepted suggestions, and unchanged drafts", () => {
    expect(refinementSaveMode("Original", "Original", "Suggested")).toBeUndefined();
    expect(refinementSaveMode("Suggested", "Original", "Suggested")).toBe(
      "ACCEPTED_SUGGESTION",
    );
    expect(refinementSaveMode("My edit", "Original", undefined)).toBe("EDITED");
  });
});
