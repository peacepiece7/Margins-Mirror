import { fireEvent, render } from "@testing-library/react-native";

import { ApiRequestError } from "@/shared/api/error";

import { RefinementScreen } from "./screens";

const mockSave = jest.fn();
const mockRefinementRefetch = jest.fn();
const mockRunRefetch = jest.fn();
const mockTimelineRefetch = jest.fn();
const readyRefinement = {
  currentContent: "Persisted reflection",
  initialContent: "Initial reflection",
  perspectiveSummary: "A different perspective",
  runId: 7,
  suggestedContent: "AI suggestion",
  suggestionStatus: "READY" as const,
};
type MockRefinement = Omit<
  typeof readyRefinement,
  "suggestedContent" | "suggestionStatus"
> & {
  suggestedContent?: string;
  suggestionStatus: "FAILED" | "PENDING" | "READY";
};

let mockRefinementData: MockRefinement | undefined;
let mockRefinementError: unknown;
let mockRefinementIsError = false;
let mockRunData: { sessionId: number } | undefined;
let mockRunError: unknown;
let mockRunIsError = false;
let mockSaveIsError = false;
let mockTimelineData: { bookId: number; sessionId: number } | undefined;
let mockTimelineError: unknown;
let mockTimelineIsError = false;

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));
jest.mock("./queries", () => ({
  useRefinement: () => ({
    data: mockRefinementData,
    error: mockRefinementError,
    isError: mockRefinementIsError,
    isLoading: false,
    refetch: mockRefinementRefetch,
  }),
  useReflectionTimeline: () => ({
    data: mockTimelineData,
    error: mockTimelineError,
    isError: mockTimelineIsError,
    isLoading: false,
    refetch: mockTimelineRefetch,
  }),
  useRun: () => ({
    data: mockRunData,
    error: mockRunError,
    isError: mockRunIsError,
    isLoading: false,
    refetch: mockRunRefetch,
  }),
  useSaveRefinement: () => ({
    isError: mockSaveIsError,
    isPending: false,
    mutate: mockSave,
  }),
}));

describe("RefinementScreen", () => {
  // BDD: RLOOP-013
  // BDD: RLOOP-014
  // BDD: RLOOP-022
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefinementData = readyRefinement;
    mockRefinementError = undefined;
    mockRefinementIsError = false;
    mockRunData = { sessionId: 3 };
    mockRunError = undefined;
    mockRunIsError = false;
    mockSaveIsError = false;
    mockTimelineData = { bookId: 2, sessionId: 3 };
    mockTimelineError = undefined;
    mockTimelineIsError = false;
  });

  // BDD: RLOOP-057, MOBILE-019
  it("restores a direct edit before saving a new revision", async () => {
    const screen = await render(
      <RefinementScreen bookId={2} onDone={jest.fn()} runId={7} />,
    );
    const editor = screen.getByLabelText("Reflection");

    expect(screen.getByText("First thought")).toBeTruthy();
    expect(screen.getByText("Initial reflection")).toBeTruthy();
    expect(screen.getByText("Perspectives from discussion")).toBeTruthy();
    expect(screen.getByText("Private")).toBeTruthy();
    expect(screen.getByTestId("refinement-draft-status")).toHaveTextContent(
      "Matches the current Reflection.",
    );

    await fireEvent.changeText(editor, "My direct edit");
    expect(screen.getByTestId("refinement-draft-status")).toHaveTextContent(
      "These changes have not been saved.",
    );
    expect(screen.getByText("AI draft · not yet committed to a revision")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Insert into editor" }));
    expect(screen.getByDisplayValue("AI suggestion")).toBeTruthy();

    await fireEvent.press(
      screen.getByRole("button", { name: "Restore my previous edit" }),
    );
    expect(screen.getByDisplayValue("My direct edit")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Save as new revision" }));
    expect(mockSave).toHaveBeenCalledWith(
      {
        finalContent: "My direct edit",
        mode: "EDITED",
        outcome: "DEEPENED",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("saves the reader-selected refinement outcome", async () => {
    const screen = await render(
      <RefinementScreen bookId={2} onDone={jest.fn()} runId={7} />,
    );

    await fireEvent.changeText(screen.getByLabelText("Reflection"), "A changed conclusion");
    await fireEvent.press(screen.getByRole("button", { name: "Changed my mind" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save as new revision" }));

    expect(mockSave).toHaveBeenCalledWith(
      {
        finalContent: "A changed conclusion",
        mode: "EDITED",
        outcome: "CHANGED",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("preserves the local draft and outcome when a pending suggestion becomes ready", async () => {
    mockRefinementData = {
      ...readyRefinement,
      suggestedContent: undefined,
      suggestionStatus: "PENDING",
    };
    const screen = await render(
      <RefinementScreen bookId={2} onDone={jest.fn()} runId={7} />,
    );

    expect(screen.getByText("AI is preparing a revision draft…")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Reflection"), "My pending edit");
    await fireEvent.press(screen.getByRole("button", { name: "Changed my mind" }));

    mockRefinementData = readyRefinement;
    await screen.rerender(
      <RefinementScreen bookId={2} onDone={jest.fn()} runId={7} />,
    );

    expect(screen.getByDisplayValue("My pending edit")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Changed my mind" }).props
        .accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getAllByText("AI suggestion")).toHaveLength(2);
  });

  // BDD: RLOOP-057, MOBILE-019
  it("keeps the first thought without inventing a replacement revision", async () => {
    const onDone = jest.fn();
    const screen = await render(
      <RefinementScreen bookId={2} onDone={onDone} runId={7} />,
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "Keep first thought" }),
    );

    expect(mockSave).toHaveBeenCalledWith(
      { mode: "KEPT", outcome: "KEPT" },
      expect.objectContaining({ onSuccess: onDone }),
    );
  });

  it("rejects a refinement timeline from another reading session", async () => {
    mockTimelineData = { bookId: 2, sessionId: 99 };
    const screen = await render(
      <RefinementScreen bookId={2} onDone={jest.fn()} runId={7} />,
    );

    expect(
      screen.getByText("This reflection workflow was not found for this book."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save as new revision" })).toBeNull();
  });

  it.each(["refinement", "run", "timeline"] as const)(
    "keeps a %s network failure retryable",
    async (query) => {
      failQuery(
        query,
        new ApiRequestError({ code: "COMMON_INTERNAL_ERROR", status: 503 }),
      );
      const screen = await render(
        <RefinementScreen bookId={2} onDone={jest.fn()} runId={7} />,
      );

      expect(
        screen.getByText("Could not load or update this reflection workflow."),
      ).toBeTruthy();
      expect(
        screen.queryByText("This reflection workflow was not found for this book."),
      ).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
      expect(refetchFor(query)).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps a transient failure retryable when another query returns 404", async () => {
    failQuery(
      "refinement",
      new ApiRequestError({ code: "COMMON_NOT_FOUND", status: 404 }),
    );
    failQuery(
      "run",
      new ApiRequestError({ code: "COMMON_INTERNAL_ERROR", status: 503 }),
    );
    const screen = await render(
      <RefinementScreen bookId={2} onDone={jest.fn()} runId={7} />,
    );

    expect(
      screen.getByText("Could not load or update this reflection workflow."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefinementRefetch).toHaveBeenCalledTimes(1);
    expect(mockRunRefetch).toHaveBeenCalledTimes(1);
  });

  it.each(["refinement", "run", "timeline"] as const)(
    "treats a %s 404 as scoped not-found without retry",
    async (query) => {
      failQuery(
        query,
        new ApiRequestError({ code: "COMMON_NOT_FOUND", status: 404 }),
      );
      const screen = await render(
        <RefinementScreen bookId={2} onDone={jest.fn()} runId={7} />,
      );

      expect(
        screen.getByText("This reflection workflow was not found for this book."),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Save as new revision" })).toBeNull();
    },
  );

  it("shows a save failure without discarding the draft or outcome", async () => {
    const screen = await render(
      <RefinementScreen bookId={2} onDone={jest.fn()} runId={7} />,
    );
    await fireEvent.changeText(screen.getByLabelText("Reflection"), "Retry this edit");
    await fireEvent.press(screen.getByRole("button", { name: "Changed my mind" }));

    mockSaveIsError = true;
    await screen.rerender(
      <RefinementScreen bookId={2} onDone={jest.fn()} runId={7} />,
    );

    expect(
      screen.getByText("Could not load or update this reflection workflow."),
    ).toBeTruthy();
    expect(screen.getByDisplayValue("Retry this edit")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Changed my mind" }).props
        .accessibilityState,
    ).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByRole("button", { name: "Save as new revision" }));
    expect(mockSave).toHaveBeenCalledWith(
      {
        finalContent: "Retry this edit",
        mode: "EDITED",
        outcome: "CHANGED",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});

type FailedQuery = "refinement" | "run" | "timeline";

function failQuery(query: FailedQuery, error: unknown) {
  if (query === "refinement") {
    mockRefinementData = undefined;
    mockRefinementError = error;
    mockRefinementIsError = true;
    return;
  }
  if (query === "run") {
    mockRunData = undefined;
    mockRunError = error;
    mockRunIsError = true;
    return;
  }
  mockTimelineData = undefined;
  mockTimelineError = error;
  mockTimelineIsError = true;
}

function refetchFor(query: FailedQuery) {
  if (query === "refinement") return mockRefinementRefetch;
  if (query === "run") return mockRunRefetch;
  return mockTimelineRefetch;
}
