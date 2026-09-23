import { act, fireEvent, render } from "@testing-library/react-native";

import { ApiRequestError } from "@/shared/api/error";
import { InterviewScreen } from "./screens";

const mockCreateGuide = jest.fn();
const mockContinueInterview = jest.fn();
const mockCompleteInterview = jest.fn();
const mockInterviewRefetch = jest.fn();
const mockResponse = jest.fn();
const mockTimelineRefetch = jest.fn();
const mockUpdateAnswer = jest.fn();
let mockGuidePending = false;
let mockGuideError = false;
let mockInterviewError: unknown;
let mockResponseError = false;
let mockTimelineError: unknown;
let mockTimelineSessionId = 5;
let mockUpdateError = false;
let mockContinueError = false;
let mockAnsweredCount = 3;
let mockCanGenerateGuide = true;
let mockMaxReached = false;
let mockSkippedCount = 0;
let mockQuestion: Record<string, unknown> | null = null;

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));
jest.mock("./queries", () => ({
  useContinueInterview: () => ({ isError: mockContinueError, isPending: false, mutate: mockContinueInterview }),
  useCompleteInterview: () => ({
    isError: false,
    isPending: false,
    mutate: mockCompleteInterview,
  }),
  useCreateGuide: () => ({
    isError: mockGuideError,
    isPending: mockGuidePending,
    mutate: mockCreateGuide,
  }),
  useInterview: () => ({
    data: {
      answeredCount: mockAnsweredCount,
      answers: [
        {
          answerRevisionId: 40,
          content: "My first answer",
          question: "What changed?",
          questionId: 9,
          version: 2,
        },
      ],
      canGenerateGuide: mockCanGenerateGuide,
      currentQuestion: mockQuestion,
      generatedCount: 3,
      guideId: null,
      interviewId: 12,
      maxReached: mockMaxReached,
      maximumQuestions: 7,
      minimumAnswers: 3,
      reflectionId: 6,
      sourceRevisionId: 18,
      skippedCount: mockSkippedCount,
      status: "ACTIVE",
      targetAnswers: 5,
    },
    error: mockInterviewError,
    isError: mockInterviewError !== undefined,
    isLoading: false,
    refetch: mockInterviewRefetch,
  }),
  useInterviewResponse: () => ({
    isError: mockResponseError,
    isPending: false,
    mutate: mockResponse,
  }),
  useReflectionTimeline: () => ({
    data: {
      bookId: 3,
      insights: [{ insightId: 6 }],
      sessionId: mockTimelineSessionId,
    },
    error: mockTimelineError,
    isError: mockTimelineError !== undefined,
    isLoading: false,
    refetch: mockTimelineRefetch,
  }),
  useUpdateInterviewAnswer: () => ({
    isError: mockUpdateError,
    isPending: false,
    mutate: mockUpdateAnswer,
    variables: undefined,
  }),
}));

describe("InterviewScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGuidePending = false;
    mockGuideError = false;
    mockInterviewError = undefined;
    mockResponseError = false;
    mockTimelineError = undefined;
    mockTimelineSessionId = 5;
    mockUpdateError = false;
    mockContinueError = false;
    mockAnsweredCount = 3;
    mockCanGenerateGuide = true;
    mockMaxReached = false;
    mockSkippedCount = 0;
    mockQuestion = null;
  });

  it("edits a prior answer with either accepted revision behavior", async () => {
    const screen = await render(
      <InterviewScreen
        bookId={3}
        interviewId={12}
        onGuide={jest.fn()}
        sessionId={5}
      />,
    );

    expect(screen.queryByText("My first answer")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Previous answers · 1" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "What changed? Edit answer" }),
    );
    await fireEvent.changeText(
      screen.getByLabelText("What changed? Edit answer"),
      "A clearer answer",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Polish wording only" }));
    expect(mockUpdateAnswer).toHaveBeenLastCalledWith(
      {
        content: "A clearer answer",
        expectedAnswerVersion: 2,
        questionId: 9,
        revisionKind: "WORDING_ONLY",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    await fireEvent.press(screen.getByRole("button", { name: "Restart from here" }));
    expect(mockUpdateAnswer).toHaveBeenLastCalledWith(
      expect.objectContaining({ revisionKind: "RESTART_FROM_HERE" }),
      expect.any(Object),
    );
  });

  it("shows complete interview progress while keeping the current question in focus", async () => {
    mockSkippedCount = 1;
    mockQuestion = {
      coverageArea: "SOCIAL_VALUE",
      question: "Who benefits from this language?",
      questionId: 20,
      sensitivity: "MEDIUM",
      sourceExcerpt: "A bounded source",
      sourceType: "REFLECTION",
      status: "current",
    };
    const screen = await render(
      <InterviewScreen bookId={3} interviewId={12} onGuide={jest.fn()} sessionId={5} />,
    );

    expect(screen.getByTestId("interview-progress")).toHaveTextContent(
      "Answer progress3 / target 5Minimum 3Generated 3/7Skipped 1",
    );
    expect(screen.getByText("Who benefits from this language?")).toBeTruthy();
    expect(screen.queryByText("My first answer")).toBeNull();
    expect(screen.getByRole("button", { name: "Previous answers · 1" }).props.accessibilityState)
      .toMatchObject({ expanded: false });
  });

  // BDD: RLOOP-041
  it("uses accepted brief defaults and retries a failed generation with the same selection", async () => {
    mockGuideError = true;
    const screen = await render(
      <InterviewScreen
        bookId={3}
        interviewId={12}
        onGuide={jest.fn()}
        sessionId={5}
      />,
    );

    expect(screen.getByText(/human-led conversation/i)).toBeTruthy();
    const advanced = screen.getByRole("button", { name: "Advanced guide settings" });
    expect(advanced.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(advanced);
    expect(screen.getByRole("button", { name: "Small group" }).props.accessibilityState)
      .toMatchObject({ selected: true });
    expect(screen.getByRole("button", { name: "AI may use private answers" }).props.accessibilityState)
      .toMatchObject({ selected: true });
    expect(screen.getByRole("button", { name: "20 minutes" }).props.accessibilityState)
      .toMatchObject({ selected: true });
    expect(screen.getByRole("button", { name: "Beginner" }).props.accessibilityState)
      .toMatchObject({ selected: true });
    expect(screen.getByRole("button", { name: "Experienced" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expert" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thought expansion" }).props.accessibilityState)
      .toMatchObject({ selected: true });

    await fireEvent.press(screen.getByRole("button", { name: "Me and AI" }));
    await fireEvent.press(screen.getByRole("button", { name: "Reflection only" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Retry with the same brief" }),
    );

    expect(mockCreateGuide).toHaveBeenCalledWith(
      {
        audienceMode: "SELF_AI",
        disclosureMode: "REFLECTION_ONLY",
        facilitationLevel: "BEGINNER",
        purpose: "THOUGHT_EXPANSION",
        targetMinutes: 20,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(screen.getByText(/selected brief is preserved/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create discussion guide" })).toBeNull();
  });

  // BDD: RLOOP-004, RLOOP-057, MOBILE-019
  it("offers question four after three answers while guide generation remains available", async () => {
    const screen = await render(
      <InterviewScreen bookId={3} interviewId={12} onGuide={jest.fn()} sessionId={5} />,
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "Continue with another question" }),
    );
    expect(mockContinueInterview).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Create discussion guide" })).toBeTruthy();
  });

  // BDD: RLOOP-005
  it("shows an explicit finish choice and skipped-question policy at the seven-question boundary", async () => {
    mockMaxReached = true;
    mockSkippedCount = 2;
    const screen = await render(
      <InterviewScreen bookId={3} interviewId={12} onGuide={jest.fn()} sessionId={5} />,
    );

    expect(screen.getByRole("button", { name: "Create discussion guide" })).toBeTruthy();
    expect(screen.getByText("You have reached the seven-question limit.")).toBeTruthy();
    expect(screen.getByText(/skipped question is reopened automatically/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue with another question" })).toBeNull();
  });

  // BDD: RLOOP-005
  it("names the persisted skipped-question reopen path at the boundary", async () => {
    mockAnsweredCount = 2;
    mockCanGenerateGuide = false;
    mockMaxReached = true;
    mockSkippedCount = 1;
    mockQuestion = {
      coverageArea: "EXPERIENCE",
      question: "One final question",
      questionId: 20,
      sensitivity: "HIGH",
      sourceExcerpt: "Source",
      sourceType: "REFLECTION",
      status: "current",
    };
    const screen = await render(
      <InterviewScreen bookId={3} interviewId={12} onGuide={jest.fn()} sessionId={5} />,
    );

    expect(
      screen.getByRole("button", { name: "Skip and reopen an earlier question" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Finish interview without a guide" }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Finish interview without a guide" }),
    );
    expect(mockCompleteInterview).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ onSuccess: undefined }),
    );
  });

  it("guards retry with the same brief while generation is pending", async () => {
    mockGuideError = true;
    mockGuidePending = true;
    const screen = await render(
      <InterviewScreen bookId={3} interviewId={12} onGuide={jest.fn()} sessionId={5} />,
    );
    expect(screen.getByRole("button", { name: "Retry with the same brief" }))
      .toBeDisabled();
  });

  // BDD: RLOOP-042
  it("bounds source copy and opens the exact source revision", async () => {
    const onSourceRevision = jest.fn();
    mockQuestion = {
      coverageArea: "TEXTUAL_INTERPRETATION",
      question: "What does this passage change?",
      questionId: 20,
      sensitivity: "LOW",
      sourceExcerpt: "A long excerpt from the selected source",
      sourceRefId: 31,
      sourceType: "BOOK_KNOWLEDGE",
      sourceVersion: "book-knowledge-v1",
      status: "current",
    };
    const screen = await render(
      <InterviewScreen
        bookId={3}
        interviewId={12}
        onGuide={jest.fn()}
        onSourceRevision={onSourceRevision}
        sessionId={5}
      />,
    );

    expect(screen.getByText("“A long excerpt from the selected source”")).toHaveProp(
      "numberOfLines",
      3,
    );
    expect(screen.getByText(/BOOK_KNOWLEDGE · book-knowledge-v1 · #31 · Reflection revision #18/))
      .toBeTruthy();
    expect(screen.getByRole("button", { name: "Create discussion guide" })).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
    });
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Reflection revision #18" }),
    );
    expect(onSourceRevision).toHaveBeenCalledWith(18);
  });

  it("hands a restarted interview lineage back to the owning route", async () => {
    const onInterview = jest.fn();
    mockUpdateAnswer.mockImplementationOnce((_input, options) =>
      options.onSuccess({ interviewId: 44 }),
    );
    const screen = await render(
      <InterviewScreen
        bookId={3}
        interviewId={12}
        onGuide={jest.fn()}
        onInterview={onInterview}
        sessionId={5}
      />,
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "Previous answers · 1" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "What changed? Edit answer" }),
    );
    await fireEvent.changeText(
      screen.getByLabelText("What changed? Edit answer"),
      "A changed answer",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Restart from here" }));

    expect(onInterview).toHaveBeenCalledWith(44);
  });

  it("keeps a network failure retryable instead of presenting not-found", async () => {
    mockInterviewError = new Error("offline");
    const screen = await render(
      <InterviewScreen bookId={3} interviewId={12} onGuide={jest.fn()} sessionId={5} />,
    );

    expect(screen.getByText("Could not load or update this reflection workflow.")).toBeTruthy();
    expect(screen.queryByText("This reflection workflow was not found for this book.")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockInterviewRefetch).toHaveBeenCalledTimes(1);
    expect(mockTimelineRefetch).toHaveBeenCalledTimes(1);
  });

  it("fails closed without retry for an authoritative interview 404", async () => {
    mockInterviewError = new ApiRequestError({ code: "COMMON_NOT_FOUND", status: 404 });
    const screen = await render(
      <InterviewScreen bookId={3} interviewId={12} onGuide={jest.fn()} sessionId={5} />,
    );

    expect(screen.getByText("This reflection workflow was not found for this book.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("fails closed when the interview route points at another reading session", async () => {
    mockTimelineSessionId = 99;
    const screen = await render(
      <InterviewScreen
        bookId={3}
        interviewId={12}
        onGuide={jest.fn()}
        sessionId={5}
      />,
    );

    expect(
      screen.getByText("This reflection workflow was not found for this book."),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Answer")).toBeNull();
  });

  // BDD: RLOOP-057, MOBILE-019
  it("saves an answer through the explicit continue CTA without clearing newer input", async () => {
    let onSuccess: (() => void) | undefined;
    mockQuestion = {
      coverageArea: "EXPERIENCE",
      question: "What stays with you?",
      questionId: 20,
      sensitivity: "LOW",
      sourceType: "REFLECTION",
      status: "current",
    };
    mockResponse.mockImplementation((_input, options) => {
      onSuccess = options.onSuccess;
    });
    const screen = await render(
      <InterviewScreen bookId={3} interviewId={12} onGuide={jest.fn()} sessionId={5} />,
    );

    expect(
      screen.getByRole("button", { name: "Save answer and continue" }),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("interview-answer-input"), "First draft");
    await fireEvent.press(screen.getByTestId("interview-answer-submit"));
    await fireEvent.changeText(screen.getByTestId("interview-answer-input"), "Newer draft");
    await act(() => onSuccess?.());

    expect(screen.getByTestId("interview-answer-input")).toHaveProp("value", "Newer draft");
  });

  it("keeps mutation failures visible while retaining the active answer", async () => {
    mockResponseError = true;
    mockQuestion = {
      coverageArea: "EXPERIENCE",
      question: "What stays with you?",
      questionId: 20,
      sensitivity: "LOW",
      sourceType: "REFLECTION",
      status: "current",
    };
    const screen = await render(
      <InterviewScreen bookId={3} interviewId={12} onGuide={jest.fn()} sessionId={5} />,
    );

    await fireEvent.changeText(screen.getByTestId("interview-answer-input"), "Keep me");

    expect(screen.getByText("Could not load or update this reflection workflow.")).toBeTruthy();
    expect(screen.getByTestId("interview-answer-input")).toHaveProp("value", "Keep me");
  });

  it("keeps answer-edit and continue failures recoverable on the same screen", async () => {
    mockUpdateError = true;
    mockContinueError = true;
    const screen = await render(
      <InterviewScreen bookId={3} interviewId={12} onGuide={jest.fn()} sessionId={5} />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Previous answers · 1" }));
    await fireEvent.press(screen.getByRole("button", { name: "What changed? Edit answer" }));
    await fireEvent.changeText(
      screen.getByLabelText("What changed? Edit answer"),
      "Keep this edit",
    );

    expect(screen.getByLabelText("What changed? Edit answer")).toHaveProp("value", "Keep this edit");
    expect(screen.getAllByText("Could not load or update this reflection workflow.").length)
      .toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("interview-continue")).toBeTruthy();
  });
});
