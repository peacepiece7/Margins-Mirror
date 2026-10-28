import { act, fireEvent, render, within } from "@testing-library/react-native";
import { Alert } from "react-native";

import { DiscussionScreen } from "./screens";

const mockMutate = jest.fn();
const mockRefetch = jest.fn();
const mockRunRefetch = jest.fn();
const mockGuideRefetch = jest.fn();
const activeRun = {
  currentItem: {
    expectedMinutes: 8,
    order: 2,
    question: "What changed?",
    sourceExcerpt: "A bounded source excerpt",
    stage: "CLOSING",
  },
  perspectiveSelectionRequired: false,
  guideId: 11,
  runId: 7,
  sessionId: 3,
  status: "ACTIVE",
  windowId: 5,
};
let mockRunData:
  | (typeof activeRun & {
      perspectiveCandidates?: { displayName: string; personaId: number }[];
    })
  | undefined;
let mockRunError: unknown;
let mockRunIsError = false;
let mockGuideData: { items: object[] } | undefined;
let mockGuideError: unknown;
let mockGuideIsError = false;
let mockGuideIsLoading = false;
let mockTimelineData: {
  bookId: number;
  messages: {
    content: string;
    createdAt?: string;
    messageId: number;
    personaId?: number;
    role: string;
    windowId: number;
  }[];
  moderationEvents: object[];
  sessionId: number;
} | undefined;
let mockTimelineError: unknown;
let mockTimelineIsError = false;
let mockTimelineIsLoading = false;

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));
jest.mock("./queries", () => ({
  useDiscussionTurn: () => ({
    isError: false,
    isPending: false,
    mutate: mockMutate,
    variables: undefined,
  }),
  useReflectionTimeline: () => ({
    data: mockTimelineData,
    error: mockTimelineError,
    isError: mockTimelineIsError,
    isLoading: mockTimelineIsLoading,
    refetch: mockRefetch,
  }),
  useGuide: () => ({
    data: mockGuideData,
    error: mockGuideError,
    isError: mockGuideIsError,
    isLoading: mockGuideIsLoading,
    refetch: mockGuideRefetch,
  }),
  useRun: () => ({
    data: mockRunData,
    error: mockRunError,
    isError: mockRunIsError,
    isLoading: false,
    refetch: mockRunRefetch,
  }),
}));

describe("DiscussionScreen", () => {
  // BDD: RLOOP-022
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunData = activeRun;
    mockRunError = undefined;
    mockRunIsError = false;
    mockGuideData = { items: [{}, {}, {}, {}] };
    mockGuideError = undefined;
    mockGuideIsError = false;
    mockGuideIsLoading = false;
    mockTimelineData = {
      bookId: 2,
      messages: [],
      moderationEvents: [],
      sessionId: 3,
    };
    mockTimelineError = undefined;
    mockTimelineIsError = false;
    mockTimelineIsLoading = false;
  });

  // BDD: RLOOP-057, MOBILE-019
  it("does not finish until the explicit refine CTA is confirmed", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const screen = await render(
      <DiscussionScreen bookId={2} onRefine={jest.fn()} runId={7} />,
    );

    await fireEvent.changeText(
      screen.getByLabelText("Answer"),
      "Closing note",
    );
    expect(screen.getByRole("button", { name: "Send answer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save and next topic" })).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Finish discussion and refine" }),
    );

    expect(mockMutate).not.toHaveBeenCalled();
    const actions = alert.mock.calls[0]?.[2];
    await act(() => actions?.[1]?.onPress?.());
    expect(mockMutate).toHaveBeenCalledWith(
      { content: "Closing note", navigation: "FINISH", personaId: undefined },
      expect.any(Object),
    );
  });

  it("preserves the composer draft when moderation blocks a response", async () => {
    mockMutate.mockImplementationOnce((_input, options) =>
      options.onSuccess({ moderation: { decision: "REJECT" } }),
    );
    const screen = await render(
      <DiscussionScreen bookId={2} onRefine={jest.fn()} runId={7} />,
    );

    await fireEvent.changeText(
      screen.getByLabelText("Answer"),
      "Keep this draft",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Send answer" }));

    expect(screen.getByDisplayValue("Keep this draft")).toBeTruthy();
  });

  it("renders the reader message optimistically with a pending reply", async () => {
    const screen = await render(
      <DiscussionScreen bookId={2} onRefine={jest.fn()} runId={7} />,
    );

    await fireEvent.changeText(screen.getByLabelText("Answer"), "My response");
    await fireEvent.press(screen.getByRole("button", { name: "Send answer" }));

    expect(screen.getByText(/You · Sending/)).toBeTruthy();
    expect(screen.getByText("The guide is preparing a reply…")).toBeTruthy();
    expect(screen.getAllByText("My response").length).toBeGreaterThan(0);
  });

  it("does not clear text entered while a discussion response is pending", async () => {
    let success: ((result: unknown) => void) | undefined;
    mockMutate.mockImplementationOnce((_input, options) => {
      success = options.onSuccess;
    });
    const screen = await render(
      <DiscussionScreen bookId={2} onRefine={jest.fn()} runId={7} />,
    );

    await fireEvent.changeText(screen.getByLabelText("Answer"), "Submitted answer");
    await fireEvent.press(screen.getByRole("button", { name: "Send answer" }));
    await fireEvent.changeText(screen.getByLabelText("Answer"), "Next draft");
    await act(() => success?.({ messages: [], moderation: null, runStatus: "ACTIVE" }));

    expect(screen.getByDisplayValue("Next draft")).toBeTruthy();
  });

  it("reveals the current source on demand and accepts a successful turn", async () => {
    mockMutate.mockImplementationOnce((_input, options) =>
      options.onSuccess({ messages: [], moderation: null, runStatus: "ACTIVE" }),
    );
    const screen = await render(
      <DiscussionScreen bookId={2} onRefine={jest.fn()} runId={7} />,
    );

    const source = screen.getByRole("button", { name: "Source details" });
    expect(screen.getByTestId("discussion-current-topic-meta")).toHaveTextContent(
      "Closing · 8 min02 / 04 topics",
    );
    expect(screen.getByText(/Messages stay private/)).toBeTruthy();
    expect(source.props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByText("A bounded source excerpt")).toBeNull();
    await fireEvent.press(source);
    expect(screen.getByText("A bounded source excerpt")).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("Answer"), "Successful turn");
    await fireEvent.press(screen.getByRole("button", { name: "Send answer" }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Successful turn" }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(screen.getByLabelText("Answer")).toHaveProp("autoFocus", true);
  });

  it("keeps a retryable run failure distinct from localized not-found", async () => {
    mockRunData = undefined;
    mockRunError = new Error("offline");
    mockRunIsError = true;
    const screen = await render(
      <DiscussionScreen bookId={2} onRefine={jest.fn()} runId={7} />,
    );

    expect(
      screen.getByText("Could not load or update this reflection workflow."),
    ).toBeTruthy();
    expect(screen.queryByText("Discussion not found.")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockRunRefetch).toHaveBeenCalledTimes(1);
  });

  it("blocks the composer and retries when the discussion guide cannot load", async () => {
    mockGuideData = undefined;
    mockGuideError = new Error("offline");
    mockGuideIsError = true;
    const screen = await render(
      <DiscussionScreen bookId={2} onRefine={jest.fn()} runId={7} />,
    );

    expect(
      screen.getByText("Could not load or update this reflection workflow."),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Answer")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockGuideRefetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a timeline from another reading session", async () => {
    mockTimelineData = {
      bookId: 2,
      messages: [],
      moderationEvents: [],
      sessionId: 99,
    };
    const screen = await render(
      <DiscussionScreen bookId={2} onRefine={jest.fn()} runId={7} />,
    );

    expect(
      screen.getByText("This reflection workflow was not found for this book."),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Answer")).toBeNull();
  });

  it("keeps progress outside the history scroll and resolves catalog, run, and ID speaker fallbacks", async () => {
    mockRunData = {
      ...activeRun,
      perspectiveCandidates: [
        { displayName: "Older run name", personaId: 42 },
        { displayName: "Run candidate", personaId: 43 },
      ],
    };
    mockTimelineData = {
      bookId: 2,
      messages: [
        {
          content: "Named perspective",
          createdAt: "2026-08-24T01:00:30Z",
          messageId: 12,
          personaId: 42,
          role: "assistant",
          windowId: 5,
        },
        {
          content: "Deleted perspective",
          createdAt: "2026-08-24T01:01:30Z",
          messageId: 13,
          personaId: 99,
          role: "assistant",
          windowId: 5,
        },
        {
          content: "Persisted run perspective",
          createdAt: "2026-08-24T01:02:30Z",
          messageId: 14,
          personaId: 43,
          role: "assistant",
          windowId: 5,
        },
      ],
      moderationEvents: [],
      sessionId: 3,
    };
    const screen = await render(
      <DiscussionScreen
        bookId={2}
        onRefine={jest.fn()}
        personaNames={{ 42: "Literary critic" }}
        runId={7}
      />,
    );
    const stickyContext = within(screen.getByTestId("discussion-sticky-context"));
    const history = within(screen.getByTestId("discussion-history-scroll"));

    expect(stickyContext.getByText("What changed?")).toBeTruthy();
    expect(history.queryByText("What changed?")).toBeNull();
    expect(history.getByText("Literary critic")).toBeTruthy();
    expect(history.queryByText("Older run name")).toBeNull();
    expect(history.getByText("Run candidate")).toBeTruthy();
    expect(history.getByText("Perspective #99")).toBeTruthy();
    expect(screen.getByTestId("discussion-message-time-12")).toHaveProp(
      "accessibilityLabel",
      "2026-08-24T01:00:30Z",
    );
  });
});
