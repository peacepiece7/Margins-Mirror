import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

import { ApiRequestError } from "@/shared/api/error";

import { GuideScreen } from "./guide-screen";

const mockEditMutate = jest.fn();
const mockRegenerateMutate = jest.fn();
const mockCreateRunMutate = jest.fn();
const mockExportMutate = jest.fn();
const mockGuideRefetch = jest.fn();
const mockVersionsRefetch = jest.fn();
let mockTimelineBookId = 3;
let mockTimelineSessionId = 5;
let mockGuideData: typeof guide | undefined;
let mockGuideError: unknown;
let mockGuideIsError = false;
let mockEditError: unknown;
let mockRegenerateError: unknown;
let mockCreateRunError: unknown;
let mockVersionsIsError = false;

const item = {
  expectedMinutes: 20,
  followUps: ["Why?"],
  intent: "Invite reflection",
  itemId: 8,
  order: 1,
  priority: "REQUIRED" as const,
  question: "What changed?",
  questionId: 9,
  sensitivity: "LOW" as const,
  skippable: false,
  sourceType: "REFLECTION",
  stage: "WARM_UP",
};
const guide = {
  audienceMode: "SELF_AI",
  current: true,
  currentGuideId: 21,
  depth: "SIMPLE",
  disclosureMode: "REFLECTION_ONLY",
  facilitationLevel: "BEGINNER",
  goal: "Original goal",
  guideId: 21,
  guideVersion: 2,
  interviewId: 12,
  issues: ["One", "Two"],
  items: [item],
  origin: "GENERATED",
  purpose: "THOUGHT_EXPANSION",
  reflectionId: 6,
  runId: null as number | null,
  sessionId: 5,
  status: "READY",
  targetMinutes: 20,
};

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));
jest.mock("./guide-export", () => ({ shareGuideMarkdown: jest.fn() }));
jest.mock("./queries", () => {
  return {
  useCreateRun: () => ({ error: mockCreateRunError, isPending: false, mutate: mockCreateRunMutate }),
  useEditGuide: () => ({
    error: mockEditError,
    isPending: false,
    mutate: mockEditMutate,
  }),
  useGuide: () => ({
    data: mockGuideData,
    error: mockGuideError,
    isError: mockGuideIsError,
    isLoading: false,
    refetch: mockGuideRefetch,
  }),
  useGuideMarkdown: () => ({ isPending: false, mutate: mockExportMutate }),
  useGuideProjection: () => ({
    data: {
      bookAuthor: "Author",
      bookTitle: "Book",
      current: true,
      goal: "Original goal",
      guideId: 21,
      guideVersion: 2,
      issues: ["One", "Two"],
      items: [
        {
          ...item,
          privateSource: false,
          sourceExcerpt: "A concise source excerpt",
          sourceLabel: "Reflection",
          sourceVersion: "reflection-v2",
        },
      ],
      projection: "FACILITATOR",
      targetMinutes: 20,
    },
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGuideVersions: () => ({
    data: {
      currentGuideId: 21,
      interviewId: 12,
      versions: [
        { current: true, guideId: 21, guideVersion: 2, hasRun: false, origin: "GENERATED", status: "READY" },
        { current: false, guideId: 14, guideVersion: 1, hasRun: true, origin: "GENERATED", status: "ARCHIVED" },
      ],
    },
    isError: mockVersionsIsError,
    refetch: mockVersionsRefetch,
  }),
  useReflectionTimeline: () => ({
    data: { bookId: mockTimelineBookId, sessionId: mockTimelineSessionId },
    error: null,
    isError: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useRegenerateGuide: () => ({
    error: mockRegenerateError,
    isPending: false,
    mutate: mockRegenerateMutate,
  }),
  };
});

describe("GuideScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGuideData = guide;
    mockGuideError = undefined;
    mockGuideIsError = false;
    mockEditError = undefined;
    mockRegenerateError = undefined;
    mockCreateRunError = undefined;
    mockVersionsIsError = false;
    mockTimelineBookId = 3;
    mockTimelineSessionId = 5;
  });

  it("navigates to the exact selected immutable version", async () => {
    const onGuideVersion = jest.fn();
    const screen = await render(
      <GuideScreen
        bookId={3}
        guideId={21}
        onDiscuss={jest.fn()}
        onGuideVersion={onGuideVersion}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "v1 · Archived" }));
    expect(onGuideVersion).toHaveBeenCalledWith(14);
  });

  // BDD: RLOOP-020 (five-stage identification; viewport checks remain external to this test)
  it("presents the five guide stages and metadata with localized labels", async () => {
    const screen = await render(
      <GuideScreen
        bookId={3}
        guideId={21}
        onDiscuss={jest.fn()}
        onGuideVersion={jest.fn()}
      />,
    );

    expect(screen.getByText("Five-stage guide")).toBeTruthy();
    expect(screen.getByText("v2 · Current · Me and AI · 20 minutes")).toBeTruthy();
    expect(screen.getByText("1. Warm-up")).toBeTruthy();
    expect(screen.getByText("2. Interpretation")).toBeTruthy();
    expect(screen.getByText("3. Experience and meaning")).toBeTruthy();
    expect(screen.getByText("4. Society and values")).toBeTruthy();
    expect(screen.getByText("5. Closing")).toBeTruthy();
    expect(screen.getByText("Warm-up · 20 min · Required")).toBeTruthy();
    expect(screen.getByText("Sensitivity: Low")).toBeTruthy();
    expect(screen.getByText("“A concise source excerpt”")).toHaveProp(
      "numberOfLines",
      3,
    );
    expect(screen.getByText("reflection-v2")).toBeTruthy();
    expect(screen.queryByText("WARM_UP · REQUIRED")).toBeNull();
  });

  it("keeps an edited draft visible when the version write conflicts", async () => {
    mockEditError = new ApiRequestError({ code: "COMMON_CONFLICT", status: 409 });
    const screen = await render(
      <GuideScreen
        bookId={3}
        guideId={21}
        onDiscuss={jest.fn()}
        onGuideVersion={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Edit guide" }));
    await fireEvent.changeText(screen.getByLabelText("Goal"), "My unsaved goal");
    await fireEvent.press(
      screen.getByRole("button", { name: "Save as a new version" }),
    );

    expect(mockEditMutate).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 2, goal: "My unsaved goal" }),
      expect.any(Object),
    );
    expect(screen.getByDisplayValue("My unsaved goal")).toBeTruthy();
    expect(screen.getByText(/Your draft is still here/)).toBeTruthy();
  });

  it("keeps the pinned guide visible when regeneration conflicts", async () => {
    mockRegenerateError = new ApiRequestError({ code: "COMMON_CONFLICT", status: 409 });
    jest.spyOn(Alert, "alert").mockImplementation((_title, _message, actions) => {
      actions?.[1]?.onPress?.();
    });
    const onGuideVersion = jest.fn();
    const screen = await render(
      <GuideScreen
        bookId={3}
        guideId={21}
        onDiscuss={jest.fn()}
        onGuideVersion={onGuideVersion}
      />,
    );
    fireEvent.press(screen.getByRole("button", { name: "Regenerate guide" }));

    expect(mockRegenerateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 2 }),
      expect.any(Object),
    );
    expect(onGuideVersion).not.toHaveBeenCalled();
    expect(screen.getAllByText("Original goal").length).toBeGreaterThan(0);
  });

  it("denies a guide whose session belongs to another route book", async () => {
    mockTimelineBookId = 99;
    const screen = await render(
      <GuideScreen
        bookId={3}
        guideId={21}
        onDiscuss={jest.fn()}
        onGuideVersion={jest.fn()}
      />,
    );

    expect(
      screen.getByText("This reflection workflow was not found for this book."),
    ).toBeTruthy();
    expect(screen.queryByText("Original goal")).toBeNull();
  });

  it("denies a guide whose timeline belongs to another reading session", async () => {
    mockTimelineSessionId = 99;
    const screen = await render(
      <GuideScreen
        bookId={3}
        guideId={21}
        onDiscuss={jest.fn()}
        onGuideVersion={jest.fn()}
      />,
    );

    expect(
      screen.getByText("This reflection workflow was not found for this book."),
    ).toBeTruthy();
    expect(screen.queryByText("Original goal")).toBeNull();
  });

  it("offers a localized retry for a guide network failure", async () => {
    mockGuideData = undefined;
    mockGuideError = new Error("offline");
    mockGuideIsError = true;
    const screen = await render(
      <GuideScreen
        bookId={3}
        guideId={21}
        onDiscuss={jest.fn()}
        onGuideVersion={jest.fn()}
      />,
    );

    expect(
      screen.getByText("Could not load or update this reflection workflow."),
    ).toBeTruthy();
    expect(
      screen.queryByText("This reflection workflow was not found for this book."),
    ).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockGuideRefetch).toHaveBeenCalledTimes(1);
  });

  it("keeps an edited draft visible after a non-conflict save failure", async () => {
    mockEditError = new Error("offline");
    const screen = await render(
      <GuideScreen
        bookId={3}
        guideId={21}
        onDiscuss={jest.fn()}
        onGuideVersion={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Edit guide" }));
    await fireEvent.changeText(screen.getByLabelText("Goal"), "My offline draft");
    await fireEvent.press(
      screen.getByRole("button", { name: "Save as a new version" }),
    );

    expect(screen.getByText("Could not load or update this reflection workflow.")).toBeTruthy();
    expect(screen.getByDisplayValue("My offline draft")).toBeTruthy();
  });

  // BDD: RLOOP-057, MOBILE-019
  it("shows recoverable errors for guide history and explicit discussion start", async () => {
    mockVersionsIsError = true;
    mockCreateRunError = new Error("offline");
    const screen = await render(
      <GuideScreen
        bookId={3}
        guideId={21}
        onDiscuss={jest.fn()}
        onGuideVersion={jest.fn()}
      />,
    );

    expect(
      screen.getAllByText("Could not load or update this reflection workflow.").length,
    ).toBeGreaterThanOrEqual(1);
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockVersionsRefetch).toHaveBeenCalledTimes(1);
    await fireEvent.press(
      screen.getByRole("button", { name: "Start discussion with this guide" }),
    );
    expect(mockCreateRunMutate).toHaveBeenCalled();
  });

  // BDD: RLOOP-057, MOBILE-019
  it("opens an existing discussion without creating another run", async () => {
    mockGuideData = { ...guide, runId: 31, status: "ACTIVE" };
    const onDiscuss = jest.fn();
    const screen = await render(
      <GuideScreen
        bookId={3}
        guideId={21}
        onDiscuss={onDiscuss}
        onGuideVersion={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Open discussion" }));

    expect(onDiscuss).toHaveBeenCalledWith(31);
    expect(mockCreateRunMutate).not.toHaveBeenCalled();
  });
});
