import { act, fireEvent, render } from "@testing-library/react-native";

import { ApiRequestError } from "@/shared/api/error";

import { deviceLocalDate } from "./workflow-inputs";
import { ReflectionScreen } from "./screens";

const mockSave = jest.fn();
const mockCreateWindow = jest.fn();
const mockGenerate = jest.fn();
const mockReflectionRefetch = jest.fn();
const mockSaveAnswer = jest.fn();
const mockTimelineRefetch = jest.fn();
const mockNotFoundError = new ApiRequestError({ code: "COMMON_NOT_FOUND", status: 404 });
let mockReflection: Record<string, unknown> | undefined;
let mockReflectionError: unknown;
let mockAuthorityBookId = 2;
let mockAuthorityError: unknown;
const mockAuthorityRefetch = jest.fn();
let mockAuthoritySessionId = 3;
const mockTimelineEnabled = jest.fn();
let mockTimelineBookId = 2;
let mockTimelineError = false;
let mockCreateWindowError = false;
let mockGenerateError = false;
let mockSaveAnswerError = false;
let mockSaveAnswerQuestionId: number | undefined;
let mockTimelineQuestions: Record<string, unknown>[] = [];
let mockTimelineWindows: Record<string, unknown>[] = [];

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));
jest.mock("./queries", () => ({
  useCreateQuestionWindow: () => ({
    isError: mockCreateWindowError,
    isPending: false,
    mutate: mockCreateWindow,
  }),
  useGenerateQuestions: () => ({
    isError: mockGenerateError,
    isPending: false,
    mutate: mockGenerate,
  }),
  useReflectionRouteAuthority: (_sessionId: number, enabled: boolean) => ({
    data: enabled && !mockAuthorityError
      ? { bookId: mockAuthorityBookId, sessionId: mockAuthoritySessionId }
      : undefined,
    error: mockAuthorityError,
    isError: Boolean(mockAuthorityError),
    isLoading: false,
    refetch: mockAuthorityRefetch,
  }),
  useReflectionTimeline: (_sessionId: number, enabled = true) => {
    mockTimelineEnabled(enabled);
    return {
      data: enabled
        ? {
            bookId: mockTimelineBookId,
            insights: [
              {
                authorName: "Reader",
                content: "**Saved**\nline two",
                evidence: "Page 10",
                insightId: 6,
                insightType: "reflection",
                reviewedOn: "2026-08-20",
                visibility: "PRIVATE",
              },
            ],
            messages: [],
            moderationEvents: [],
            questions: mockTimelineQuestions,
            sessionId: 3,
            windows: mockTimelineWindows,
          }
        : undefined,
      error: mockTimelineError ? new Error("timeline unavailable") : undefined,
      isError: mockTimelineError,
      isLoading: false,
      refetch: mockTimelineRefetch,
    };
  },
  useSaveAnswer: () => ({
    isError: mockSaveAnswerError,
    isPending: false,
    mutate: mockSaveAnswer,
    variables: mockSaveAnswerQuestionId
      ? { questionId: mockSaveAnswerQuestionId }
      : undefined,
  }),
  useSaveReflection: () => ({ isError: false, isPending: false, mutate: mockSave }),
  useSessionReflection: () => ({
    data: mockReflection,
    error: mockReflectionError ?? (mockReflection ? undefined : mockNotFoundError),
    isError: Boolean(mockReflectionError) || !mockReflection,
    isLoading: false,
    refetch: mockReflectionRefetch,
  }),
  useStartInterview: () => ({ isError: false, isPending: false, mutate: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockReflection = undefined;
  mockReflectionError = undefined;
  mockAuthorityBookId = 2;
  mockAuthorityError = undefined;
  mockAuthoritySessionId = 3;
  mockTimelineBookId = 2;
  mockTimelineError = false;
  mockCreateWindowError = false;
  mockGenerateError = false;
  mockSaveAnswerError = false;
  mockSaveAnswerQuestionId = undefined;
  mockTimelineQuestions = [];
  mockTimelineWindows = [];
});

it("defaults a new reflection to the device-local date and previews the original Markdown text", async () => {
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  expect(screen.getByLabelText("Review date (YYYY-MM-DD)")).toHaveProp(
    "value",
    deviceLocalDate(),
  );
  await fireEvent.changeText(screen.getByLabelText("Reflection"), "**Bold**\nnext line");
  await fireEvent.press(screen.getByRole("button", { name: "Show Markdown preview" }));
  expect(screen.getByLabelText("Markdown preview")).toBeTruthy();
  expect(screen.getByText("Bold")).toHaveStyle({ fontWeight: "700" });
  expect(screen.getByText("next line")).toBeTruthy();
});

it("disables duplicate unchanged saves and keeps Saved Notes separate from the editor", async () => {
  mockReflection = {
    bookId: 2,
    currentRevision: { content: "Persisted", revisionId: 6, version: 1 },
    reflectionId: 6,
    revisions: [],
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  expect(screen.getByRole("button", { name: "Save reflection" })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText("Reflection"), "Changed");
  expect(screen.getByRole("button", { name: "Save reflection" })).toBeEnabled();

  await fireEvent.press(screen.getByRole("button", { name: "Show saved notes" }));
  expect(screen.queryByLabelText("Reflection")).toBeNull();
  expect(screen.getByText("Saved")).toHaveStyle({ fontWeight: "700" });
  expect(screen.getByText("line two")).toBeTruthy();
  expect(screen.getByText("Evidence: Page 10")).toBeTruthy();
});

// BDD: RLOOP-057, MOBILE-019
it("opens every persisted Reflection Loop stage and returns Record to the editor", async () => {
  mockReflection = {
    activeInterviewId: 7,
    bookId: 2,
    currentRevision: { content: "Persisted", revisionId: 6, version: 1 },
    guideId: 8,
    reflectionId: 6,
    revisions: [],
    runId: 9,
    runStatus: "COMPLETED",
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  const onWorkflow = jest.fn();
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={onWorkflow} sessionId={3} />,
  );

  expect(screen.getByTestId("reflection-loop-progress")).toBeTruthy();
  expect(screen.getAllByText("Complete")).toHaveLength(4);
  expect(screen.getByTestId("reflection-loop-step-refine")).toHaveTextContent("05RefineRevisionCurrent›");
  await fireEvent.press(screen.getByRole("button", { name: "Interview, Complete" }));
  await fireEvent.press(screen.getByRole("button", { name: "Guide, Complete" }));
  await fireEvent.press(screen.getByRole("button", { name: "Discuss, Complete" }));
  await fireEvent.press(screen.getByRole("button", { name: "Refine, Current" }));
  expect(onWorkflow.mock.calls).toEqual([
    [{ id: 7, kind: "interview" }],
    [{ id: 8, kind: "guide" }],
    [{ id: 9, kind: "discuss" }],
    [{ id: 9, kind: "refine" }],
  ]);

  await fireEvent.press(screen.getByRole("button", { name: "Show saved notes" }));
  expect(screen.queryByLabelText("Reflection")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Record, Complete" }));
  expect(screen.getByLabelText("Reflection")).toBeTruthy();
});

it("prevents current-stage navigation while the Reflection draft has unsaved changes", async () => {
  mockReflection = {
    activeInterviewId: 7,
    bookId: 2,
    currentRevision: { content: "Persisted", revisionId: 6, version: 1 },
    reflectionId: 6,
    revisions: [],
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  await fireEvent.changeText(screen.getByLabelText("Reflection"), "Unsaved edit");
  expect(screen.getByRole("button", { name: "Record, Complete" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Interview, Current" })).toBeDisabled();
});

// BDD: RLOOP-057, MOBILE-019
it("keeps future Reflection Loop stages non-interactive without persisted locators", async () => {
  mockReflection = {
    activeInterviewId: 7,
    bookId: 2,
    currentRevision: { content: "Persisted", revisionId: 6, version: 1 },
    reflectionId: 6,
    revisions: [],
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  expect(screen.getByRole("button", { name: "Interview, Current" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Guide, Later" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Discuss, Later" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Refine, Later" })).toBeNull();
});

it("hydrates saved metadata without turning it into a duplicate save", async () => {
  mockReflection = {
    bookId: 2,
    currentRevision: { content: "Persisted", revisionId: 6, version: 1 },
    reflectionId: 6,
    revisions: [],
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  await fireEvent.press(screen.getByRole("button", { name: "Show saved notes" }));
  await fireEvent.press(screen.getByRole("button", { name: "Back to reflection" }));

  expect(screen.getByLabelText("Evidence")).toHaveProp("value", "Page 10");
  expect(screen.getByLabelText("Author display name")).toHaveProp("value", "Reader");
  expect(screen.getByRole("button", { name: "Save reflection" })).toBeDisabled();
});

// BDD: RLOOP-055
it("opens an existing Reflection and preserves metadata when the lazy timeline is unavailable", async () => {
  mockReflection = {
    authorName: "Saved author",
    bookId: 2,
    currentRevision: { content: "Persisted", revisionId: 6, version: 1 },
    evidence: "Saved evidence",
    reflectionId: 6,
    revisions: [],
    reviewedOn: "2026-08-20",
    sessionId: 3,
    title: "Saved title",
    visibility: "PUBLIC",
  };
  mockTimelineError = true;
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  expect(screen.getByLabelText("Evidence")).toHaveProp("value", "Saved evidence");
  expect(screen.getByLabelText("Author display name")).toHaveProp("value", "Saved author");
  expect(mockTimelineEnabled).toHaveBeenLastCalledWith(false);
  await fireEvent.changeText(screen.getByLabelText("Reflection"), "Direct edit");
  await fireEvent.press(screen.getByRole("button", { name: "Save reflection" }));

  expect(mockSave).toHaveBeenCalledWith(
    {
      authorName: "Saved author",
      content: "Direct edit",
      evidence: "Saved evidence",
      reviewedOn: "2026-08-20",
      title: "Saved title",
      visibility: "PUBLIC",
    },
  );
});

it("rejects an existing Reflection identity mismatch before mutation controls render", async () => {
  mockReflection = {
    bookId: 99,
    currentRevision: { content: "Persisted", revisionId: 6, version: 1 },
    reflectionId: 6,
    revisions: [],
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  const existing = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );
  expect(existing.getByText("This reflection workflow was not found for this book.")).toBeTruthy();
  expect(existing.queryByRole("button", { name: "Save reflection" })).toBeNull();
});

// BDD: RLOOP-055
it("rejects a missing Reflection session mismatch before create controls render", async () => {
  mockReflection = undefined;
  mockAuthorityBookId = 99;
  const missing = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );
  expect(missing.getByText("This reflection workflow was not found for this book.")).toBeTruthy();
  expect(missing.queryByRole("button", { name: "Save reflection" })).toBeNull();
});

it("treats a missing authority record as not-found without exposing retry or mutation", async () => {
  mockAuthorityError = mockNotFoundError;
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  expect(screen.getByText("This reflection workflow was not found for this book.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Save reflection" })).toBeNull();
});

it.each([
  ["network", new ApiRequestError({ code: "COMMON_NETWORK_ERROR" })],
  ["server", new ApiRequestError({ code: "COMMON_INTERNAL_ERROR", status: 503 })],
])("keeps a %s authority failure retryable without exposing mutation controls", async (_label, error) => {
  mockAuthorityError = error;
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  expect(screen.getByText("Could not load or update this reflection workflow.")).toBeTruthy();
  expect(screen.queryByText("This reflection workflow was not found for this book.")).toBeNull();
  expect(screen.queryByRole("button", { name: "Save reflection" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(mockAuthorityRefetch).toHaveBeenCalledTimes(1);
});

it("keeps a primary Reflection network failure retryable", async () => {
  mockReflectionError = new ApiRequestError({ code: "COMMON_NETWORK_ERROR" });
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  expect(screen.getByText("Could not load or update this reflection workflow.")).toBeTruthy();
  await fireEvent.press(screen.getByTestId("reflection-load-retry"));
  expect(mockReflectionRefetch).toHaveBeenCalledTimes(1);
});

it("offers a timeline retry without hiding the current Reflection draft", async () => {
  mockReflection = {
    bookId: 2,
    currentRevision: { content: "Persisted", revisionId: 6, version: 1 },
    reflectionId: 6,
    revisions: [],
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  mockTimelineError = true;
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  await fireEvent.changeText(screen.getByLabelText("Reflection"), "Unsaved draft");
  await fireEvent.press(screen.getByRole("button", { name: "Show saved notes" }));
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(mockTimelineRefetch).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: "Back to reflection" }));
  expect(screen.getByLabelText("Reflection")).toHaveProp("value", "Unsaved draft");
});

it("shows question mutation failures and clears only the submitted answer draft", async () => {
  let answerSucceeded: (() => void) | undefined;
  mockReflection = {
    bookId: 2,
    currentRevision: { content: "Persisted", revisionId: 6, version: 1 },
    reflectionId: 6,
    revisions: [],
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  mockGenerateError = true;
  mockSaveAnswerError = true;
  mockSaveAnswerQuestionId = 8;
  mockTimelineWindows = [{ windowId: 7, windowType: "question" }];
  mockTimelineQuestions = [{
    questionId: 8,
    questionText: "What changed?",
    windowId: 7,
  }];
  mockSaveAnswer.mockImplementation((_input, options) => {
    answerSucceeded = options.onSuccess;
  });
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  await fireEvent.press(screen.getByRole("button", { name: "Show reflection questions" }));
  await fireEvent.changeText(screen.getByLabelText("Question focus (optional)"), "Power");
  await fireEvent.press(screen.getByRole("button", { name: "Generate questions" }));
  expect(mockGenerate).toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText("Answer"), "Submitted answer");
  await fireEvent.press(screen.getByRole("button", { name: "Answer" }));
  await fireEvent.changeText(screen.getByLabelText("Answer"), "Newer answer");
  await act(() => answerSucceeded?.());

  expect(screen.getAllByText("Could not load or update this reflection workflow.").length)
    .toBeGreaterThanOrEqual(2);
  expect(screen.getByLabelText("Answer")).toHaveProp("value", "Newer answer");
});

it("surfaces a question-window creation failure on the active question panel", async () => {
  mockReflection = {
    bookId: 2,
    currentRevision: { content: "Persisted", revisionId: 6, version: 1 },
    reflectionId: 6,
    revisions: [],
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  mockCreateWindowError = true;
  const screen = await render(
    <ReflectionScreen bookId={2} bookTitle="Book" onWorkflow={jest.fn()} sessionId={3} />,
  );

  await fireEvent.press(screen.getByRole("button", { name: "Show reflection questions" }));
  await fireEvent.press(screen.getByRole("button", { name: "Create question window" }));
  expect(mockCreateWindow).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Could not load or update this reflection workflow.")).toBeTruthy();
});

// BDD: RLOOP-042
it("renders only an immutable revision that belongs to the loaded Reflection", async () => {
  mockReflection = {
    bookId: 2,
    currentRevision: { content: "Current", revisionId: 7, version: 2 },
    reflectionId: 6,
    revisions: [
      { content: "Immutable source", revisionId: 18, version: 1 },
      { content: "Current", revisionId: 7, version: 2 },
    ],
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  const onClose = jest.fn();
  const screen = await render(
    <ReflectionScreen
      bookId={2}
      bookTitle="Book"
      onCloseSourceRevision={onClose}
      onWorkflow={jest.fn()}
      sessionId={3}
      sourceRevisionId={18}
    />,
  );

  expect(screen.getByText("Reflection revision #18 · v1")).toBeTruthy();
  expect(screen.getByText("Immutable source")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save reflection" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back to reflection" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

// BDD: RLOOP-042
it("rejects a source revision when its session belongs to another route book", async () => {
  mockTimelineBookId = 99;
  mockReflection = {
    bookId: 2,
    currentRevision: { content: "Current", revisionId: 7, version: 2 },
    reflectionId: 6,
    revisions: [{ content: "Wrong book source", revisionId: 18, version: 1 }],
    sessionId: 3,
    title: "Saved title",
    visibility: "PRIVATE",
  };
  const screen = await render(
    <ReflectionScreen
      bookId={2}
      bookTitle="Book"
      onWorkflow={jest.fn()}
      sessionId={3}
      sourceRevisionId={18}
    />,
  );

  expect(screen.getByText("This reflection workflow was not found for this book.")).toBeTruthy();
  expect(screen.queryByText("Wrong book source")).toBeNull();
});
