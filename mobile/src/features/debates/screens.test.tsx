import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { Alert } from "react-native";

import { DebateRoomScreen, DebateRoomsScreen } from "./screens";

const mockOnRoom = jest.fn();
const mockRefetch = jest.fn();
const mockRefetchSession = jest.fn();
const mockCreate = jest.fn();
const mockCreatePersona = jest.fn();
const mockEnsure = jest.fn();
const mockDebate = jest.fn();
const mockRename = jest.fn();
const mockArchive = jest.fn();
const mockEdit = jest.fn();
const mockDelete = jest.fn();
const mockFeedback = jest.fn();
const mockStream = jest.fn();
let mockStreamError = false;
let mockOnStreamDelta: (value: string) => void = () => undefined;
let mockDebatePending = false;
let mockRecommendedPersonaIds: number[] = [];
let mockSessionData: { sessionId: number; title: string } | undefined = { sessionId: 3, title: "Reading" };
let mockPersonas = [
  { displayName: "Analyst", name: "analyst", personaId: 4 },
  { displayName: "Journalist", name: "journalist", personaId: 5, tone: "stored" },
];

const timeline: import("./types").DebateTimeline = {
  bookId: 2,
  insights: [
    { content: "My answer", insightId: 12, insightType: "question_answer", questionId: 8 },
  ],
  messages: [
    {
      content: "Saved reader message",
      createdAt: "2026-08-24T01:00:00Z",
      messageId: 21,
      messageOrder: 1,
      role: "user",
      sessionId: 3,
      windowId: 7,
    },
  ],
  moderationEvents: [
    {
      createdAt: "2026-08-24T01:01:00Z",
      decision: "REDIRECT",
      eventId: 31,
      fallbackUsed: false,
      intent: "BENIGN_OFF_TOPIC",
      personaCalled: false,
      reasonCode: "BENIGN_OFF_TOPIC",
      routingOutcome: "REDIRECT",
      sessionId: 3,
      suggestedQuestion: "How does this connect to the chapter?",
      userFeedback: null,
      windowId: 7,
    },
  ],
  questions: [
    { questionId: 8, questionText: "What changed?", status: "active", windowId: 4 },
  ],
  sessionId: 3,
  windows: [
    {
      personaIds: [4],
      sessionId: 3,
      sourceQuestionId: 8,
      status: "active",
      title: "Debate: Meaning",
      windowId: 7,
      windowType: "debate",
    },
  ],
};
let mockTimelineData: import("./types").DebateTimeline | undefined = timeline;

function mockMutation(mutate: jest.Mock, extra: Record<string, unknown> = {}) {
  return {
    isError: false,
    isPending: false,
    mutate,
    ...extra,
  };
}

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));
jest.mock("./queries", () => ({
  useArchiveDebateWindow: () => mockMutation(mockArchive),
  useBookDebateSession: () => ({ data: mockSessionData, isError: false, isLoading: false }),
  useCreatePersona: () => mockMutation(mockCreatePersona),
  useDebateTimeline: (sessionId: number) => ({
    data: sessionId > 0 ? mockTimelineData : undefined,
    isError: false,
    isLoading: sessionId > 0 && mockTimelineData === undefined,
    refetch: mockRefetch,
  }),
  useDeleteDebateMessage: () => mockMutation(mockDelete),
  useEditDebateMessage: () => mockMutation(mockEdit),
  useEnsureQuestionDebateWindow: () => mockMutation(mockEnsure, { reset: jest.fn() }),
  useModerationFeedback: () => mockMutation(mockFeedback),
  usePersonaCatalog: () => ({
    data: { personas: mockPersonas },
    isError: false,
    isLoading: false,
  }),
  usePersonaDebate: () => mockMutation(mockDebate, { isPending: mockDebatePending }),
  usePersonaRecommendations: () => ({ data: { personas: mockPersonas.filter((persona) => mockRecommendedPersonaIds.includes(persona.personaId)) }, isError: false, isLoading: false }),
  useRenameDebateWindow: () => mockMutation(mockRename),
  useStreamMessage: (_sessionId: number, _windowId: number, onDelta: (value: string) => void) => {
    mockOnStreamDelta = onDelta;
    return mockMutation(mockStream, { isError: mockStreamError });
  },
}));

const bookProps = { bookAuthor: "Frank Herbert", bookId: 2, bookTitle: "Dune" };
const roomListProps = {
  ...bookProps,
  createRoomError: false,
  createRoomPending: false,
  onCreateRoom: mockCreate,
  onReloadSession: mockRefetchSession,
  sessionError: false,
  sessionId: 3,
  sessionLoading: false,
};

describe("native debate workflows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStreamError = false;
    mockDebatePending = false;
    mockRecommendedPersonaIds = [];
    mockSessionData = { sessionId: 3, title: "Reading" };
    mockTimelineData = timeline;
    mockPersonas = [
      { displayName: "Analyst", name: "analyst", personaId: 4 },
      { displayName: "Journalist", name: "journalist", personaId: 5, tone: "stored" },
    ];
  });

  // BDD: DEBATE-021, MOBILE-019
  it("lists, opens and reloads rooms, and reuses a question-linked room", async () => {
    mockEnsure.mockImplementation((_questionId, options) =>
      options.onSuccess({ sessionId: 3, windowId: 7 }),
    );
    const screen = await render(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} questionId={8} />);

    await waitFor(() => expect(mockEnsure).toHaveBeenCalledWith(8, expect.any(Object)));
    expect(mockOnRoom).toHaveBeenCalledWith(7);
    expect(screen.getByText("Each saved window keeps its topic and selected perspectives together.")).toBeTruthy();
    expect(screen.getByText("Analyst")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Debate: Meaning" }));
    await fireEvent.press(screen.getByRole("button", { name: "Reload rooms" }));
    expect(mockOnRoom).toHaveBeenLastCalledWith(7);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockDebate).not.toHaveBeenCalled();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // BDD: MOBILE-010 - a question-linked debate mutation waits for route and
  // authoritative timeline identity to agree.
  it.each([
    ["book", { ...timeline, bookId: 99 }],
    ["session", { ...timeline, sessionId: 99 }],
    ["question", { ...timeline, questions: [] }],
  ])("rejects a mismatched %s timeline without ensuring a question room", async (_scope, mismatchedTimeline) => {
    mockTimelineData = mismatchedTimeline;

    const screen = await render(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} questionId={8} />);

    expect(await screen.findByText("Debate room not found.")).toBeTruthy();
    expect(mockEnsure).not.toHaveBeenCalled();
    expect(mockOnRoom).not.toHaveBeenCalled();
  });

  it("waits for the authoritative timeline before ensuring a question room", async () => {
    mockTimelineData = undefined;
    const screen = await render(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} questionId={8} />);
    expect(mockEnsure).not.toHaveBeenCalled();

    mockTimelineData = timeline;
    await screen.rerender(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} questionId={8} />);

    await waitFor(() => expect(mockEnsure).toHaveBeenCalledWith(8, expect.any(Object)));
  });

  it.each([
    ["loading", { sessionLoading: true }],
    ["error", { sessionError: true }],
  ])("keeps an accessible exit in the room-list %s state", async (_state, override) => {
    const onBack = jest.fn();
    const screen = await render(
      <DebateRoomsScreen
        {...roomListProps}
        {...override}
        onBack={onBack}
        onRoom={mockOnRoom}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // BDD: FRONT-042, FRONT-043, FRONT-123
  // BDD: FRONT-123
  it("shows the current topic, clears the composer, and aligns an optimistic reader message while a reply is pending", async () => {
    mockDebate.mockImplementation(() => { mockDebatePending = true; });
    const screen = await render(<DebateRoomScreen {...bookProps} onArchived={jest.fn()} windowId={7} />);

    expect(await screen.findByText("What changed?")).toBeTruthy();
    expect(screen.getByText("My answer")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Persona debate"), "A new thought");
    await fireEvent.press(screen.getByRole("button", { name: "Send to room" }));
    expect(screen.getByLabelText("Persona debate").props.value).toBe("");
    await screen.rerender(<DebateRoomScreen {...bookProps} onArchived={jest.fn()} windowId={7} />);

    expect(screen.getByTestId("bdd-front-123-current-topic")).toHaveTextContent("Meaning");
    expect(screen.getAllByTestId("bdd-front-042-reader-message")).toHaveLength(2);
    expect(screen.getByText("A new thought")).toBeTruthy();
    expect(screen.getByTestId("bdd-front-043-reply-skeleton")).toHaveProp("accessibilityRole", "progressbar");
    expect(screen.getByTestId("bdd-front-043-reply-skeleton")).toHaveProp("accessibilityLabel", "Perspectives are preparing a reply.");
    expect(mockDebate).toHaveBeenCalledWith(
      { content: "A new thought", personaIds: [4] },
      expect.any(Object),
    );
  });

  it("carries a newly created room topic into the first composer draft once", async () => {
    mockTimelineData = { ...timeline, messages: [] };
    const screen = await render(
      <DebateRoomScreen {...bookProps} onArchived={jest.fn()} windowId={7} />,
    );

    await waitFor(() => expect(screen.getByLabelText("Persona debate")).toHaveProp("value", "Meaning"));
    await fireEvent.changeText(screen.getByLabelText("Persona debate"), "My expanded opening");
    await screen.rerender(
      <DebateRoomScreen {...bookProps} onArchived={jest.fn()} windowId={7} />,
    );

    expect(screen.getByLabelText("Persona debate")).toHaveProp("value", "My expanded opening");
  });

  it.each([
    ["timeline", { ...timeline, sessionId: 99 }],
    [
      "room",
      {
        ...timeline,
        windows: timeline.windows.map((window) => ({ ...window, sessionId: 99 })),
      },
    ],
  ])("rejects a debate room owned by another %s session", async (_scope, mismatchedTimeline) => {
    mockTimelineData = mismatchedTimeline;

    const screen = await render(
      <DebateRoomScreen {...bookProps} onArchived={jest.fn()} windowId={7} />,
    );

    expect(await screen.findByText("Debate room not found.")).toBeTruthy();
    expect(screen.queryByLabelText("Persona debate")).toBeNull();
  });

  // BDD: FRONT-043
  it("restores the submitted draft after a failed mutation without overwriting newer input", async () => {
    const screen = await render(<DebateRoomScreen {...bookProps} onArchived={jest.fn()} windowId={7} />);
    await fireEvent.changeText(screen.getByLabelText("Persona debate"), "Retry this thought");
    await fireEvent.press(screen.getByRole("button", { name: "Send to room" }));
    const options = mockDebate.mock.calls[0]?.[1];
    await act(() => options.onError());
    expect(screen.getByLabelText("Persona debate").props.value).toBe("Retry this thought");

    await fireEvent.changeText(screen.getByLabelText("Persona debate"), "Newer draft");
    await act(() => options.onError());
    expect(screen.getByLabelText("Persona debate").props.value).toBe("Newer draft");
  });

  // BDD: FRONT-042, FRONT-123, FRONT-125
  it("renders persona Markdown-like content on the left and hides other-room messages", async () => {
    timeline.messages.push(
      {
        content: "**Claim**: Read  closely\nSupport: The chapter",
        createdAt: "2026-08-24T01:00:30Z",
        messageId: 22,
        messageOrder: 2,
        personaId: 4,
        role: "assistant",
        sessionId: 3,
        windowId: 7,
      },
      {
        content: "Other room only",
        createdAt: "2026-08-24T01:00:40Z",
        messageId: 23,
        messageOrder: 1,
        personaId: 4,
        role: "assistant",
        sessionId: 3,
        windowId: 99,
      },
    );
    const screen = await render(<DebateRoomScreen {...bookProps} onArchived={jest.fn()} windowId={7} />);
    expect(screen.getByTestId("bdd-front-042-persona-message").props.style).toContainEqual(
      expect.objectContaining({ justifyContent: "flex-start" }),
    );
    expect(screen.getByTestId("debate-structured-response")).toBeTruthy();
    expect(screen.getByTestId("debate-message-time-22")).toHaveProp(
      "accessibilityLabel",
      "2026-08-24T01:00:30Z",
    );
    expect(screen.queryByText("Other room only")).toBeNull();
    timeline.messages.splice(-2);
  });

  // BDD: FRONT-128
  it("requests the next answer from the visible persona with the fewest replies", async () => {
    timeline.windows[0].personaIds = [4, 5];
    timeline.messages.push({
      content: "Prior perspective",
      createdAt: "2026-08-24T01:00:30Z",
      messageId: 22,
      messageOrder: 2,
      personaId: 4,
      role: "assistant",
      sessionId: 3,
      windowId: 7,
    });
    const screen = await render(<DebateRoomScreen {...bookProps} onArchived={jest.fn()} windowId={7} />);
    await fireEvent.press(screen.getByRole("button", { name: "Get next reply" }));
    expect(mockDebate).toHaveBeenCalledWith(
      { content: "Meaning", personaIds: [5] },
      expect.any(Object),
    );
    timeline.windows[0].personaIds = [4];
    timeline.messages.pop();
  });

  // BDD: FRONT-129
  it("creates and selects a custom persona for the next room", async () => {
    mockCreatePersona.mockImplementation((_input, options) => {
      mockPersonas = [...mockPersonas, { displayName: "Close Reader", name: "reader-close-reader", personaId: 9 }];
      options.onSuccess({ personas: mockPersonas });
    });
    const screen = await render(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} />);
    await fireEvent.changeText(screen.getByLabelText("Perspective name"), "Close Reader");
    await fireEvent.changeText(screen.getByLabelText("Instructions for this perspective"), "Stay close to the text.");
    await fireEvent.press(screen.getByRole("button", { name: "Save perspective" }));
    expect(mockCreatePersona).toHaveBeenCalledWith({
      description: "Stay close to the text.",
      displayName: "Close Reader",
      systemPrompt: "Stay close to the text.",
    }, expect.any(Object));
    await screen.rerender(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} />);
    await fireEvent.changeText(screen.getByLabelText("Debate topic"), "A close reading");
    await fireEvent.press(screen.getAllByRole("button", { name: "Open a new discussion room" }).at(-1)!);
    expect(mockCreate).toHaveBeenCalledWith({
      personaIds: [9],
      topic: "A close reading",
    });
  });

  // BDD: FRONT-166 then-2/then-3
  // BDD: FRONT-167 then-1/then-2
  it("uses a selected Book Knowledge topic and its stable Persona keys instead of category defaults", async () => {
    mockPersonas = [
      { displayName: "Category Default", name: "category-default", personaId: 4 },
      { displayName: "Literary Critic", name: "literary-critic", personaId: 8 },
      { displayName: "Historical Context", name: "historical-context", personaId: 9 },
    ];
    mockRecommendedPersonaIds = [4];
    const screen = await render(
      <DebateRoomsScreen
        {...roomListProps}
        onRoom={mockOnRoom}
        recommendedPersonaKeys={["LITERARY_CRITIC", "historical-context"]}
        recommendedTopic="What makes fear useful?"
      />,
    );
    const summary = within(screen.getByTestId("debate-speaker-summary"));

    expect(screen.getByLabelText("Debate topic")).toHaveProp("value", "What makes fear useful?");
    expect(summary.getByText("Literary Critic")).toBeTruthy();
    expect(summary.getByText("Historical Context")).toBeTruthy();
    expect(summary.queryByText("Category Default")).toBeNull();
    await fireEvent.press(summary.getByRole("button", { name: "Change speakers" }));
    const dialog = within(screen.getByTestId("change-speakers-dialog"));
    await fireEvent.press(dialog.getByRole("button", { name: "Historical Context: Selected" }));
    await fireEvent.press(dialog.getByRole("button", { name: "Apply speakers" }));
    expect(summary.queryByText("Historical Context")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Open a new discussion room" }));
    expect(mockCreate).toHaveBeenCalledWith({
      personaIds: [8],
      topic: "What makes fear useful?",
    });
  });

  // BDD: FRONT-168 then-1/then-2
  it("requires a manual topic and at least one Persona without Book Knowledge", async () => {
    mockRecommendedPersonaIds = [];
    const screen = await render(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} />);
    const createButton = screen.getByRole("button", { name: "Open a new discussion room" });

    expect(createButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Debate topic"), "Power and prophecy");
    await fireEvent.press(within(screen.getByTestId("debate-speaker-summary")).getByRole("button", { name: "Change speakers" }));
    const dialog = within(screen.getByTestId("change-speakers-dialog"));
    await fireEvent.press(dialog.getByRole("button", { name: "Analyst: Select" }));
    await fireEvent.press(dialog.getByRole("button", { name: "Apply speakers" }));
    await fireEvent.press(createButton);

    expect(mockCreate).toHaveBeenCalledWith({
      personaIds: [4],
      topic: "Power and prophecy",
    });
  });

  // BDD: SESSION-006
  // BDD: FRONT-039
  it("keeps the room creation form available before a reading session exists", async () => {
    mockRecommendedPersonaIds = [4];
    const screen = await render(
      <DebateRoomsScreen
        {...roomListProps}
        onRoom={mockOnRoom}
        sessionId={undefined}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText("Debate topic"), "A first topic");
    await fireEvent.press(screen.getByRole("button", { name: "Open a new discussion room" }));

    expect(mockCreate).toHaveBeenCalledWith({
      personaIds: [4],
      topic: "A first topic",
    });
  });

  // BDD: SESSION-006
  // BDD: FRONT-039
  it("keeps the selected topic and speakers visible when room creation fails", async () => {
    mockRecommendedPersonaIds = [4];
    const screen = await render(<DebateRoomsScreen {...roomListProps} createRoomError onRoom={mockOnRoom} />);

    await fireEvent.changeText(screen.getByLabelText("Debate topic"), "Power and memory");

    expect(screen.getByText("The debate room could not be created. Your topic and speakers were kept.")).toBeTruthy();
    expect(screen.getByLabelText("Debate topic")).toHaveProp("value", "Power and memory");
    expect(within(screen.getByTestId("debate-speaker-summary")).getByText("Analyst")).toBeTruthy();
  });

  // BDD: FRONT-091
  it("corrects a stale new-room Persona and blocks creation when the refreshed catalog is empty", async () => {
    mockRecommendedPersonaIds = [4];
    const screen = await render(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} />);
    await fireEvent.changeText(screen.getByLabelText("Debate topic"), "Changing perspectives");

    mockPersonas = [{ displayName: "Journalist", name: "journalist", personaId: 5 }];
    await screen.rerender(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} />);
    expect(within(screen.getByTestId("debate-speaker-summary")).getByText("Journalist")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Open a new discussion room" }));
    expect(mockCreate).toHaveBeenLastCalledWith({
      personaIds: [5],
      topic: "Changing perspectives",
    });

    mockCreate.mockClear();
    mockPersonas = [];
    await screen.rerender(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} />);
    const createButton = screen.getByRole("button", { name: "Open a new discussion room" });
    expect(createButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(createButton);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // BDD: FRONT-174
  it("edits at most two speakers in a focused apply-or-cancel dialog", async () => {
    mockPersonas = [
      ...mockPersonas,
      { displayName: "Skeptic", name: "skeptic", personaId: 6 },
    ];
    mockRecommendedPersonaIds = [4, 5];
    const screen = await render(<DebateRoomsScreen {...roomListProps} onRoom={mockOnRoom} />);
    const summary = within(screen.getByTestId("debate-speaker-summary"));

    expect(summary.getByText("Speakers")).toBeTruthy();
    expect(summary.getByText("Analyst")).toBeTruthy();
    expect(summary.getByText("Journalist")).toBeTruthy();
    expect(summary.queryByText("Skeptic")).toBeNull();
    await fireEvent.press(summary.getByRole("button", { name: "Change speakers" }));
    let dialog = within(screen.getByTestId("change-speakers-dialog"));
    expect(dialog.getByRole("button", { name: "Skeptic: Select" }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(dialog.getByRole("button", { name: "Analyst: Selected" }));
    await fireEvent.press(dialog.getByRole("button", { name: "Cancel" }));
    expect(summary.getByText("Analyst")).toBeTruthy();
    expect(summary.getByText("Journalist")).toBeTruthy();

    await fireEvent.press(summary.getByRole("button", { name: "Change speakers" }));
    dialog = within(screen.getByTestId("change-speakers-dialog"));
    await fireEvent.press(dialog.getByRole("button", { name: "Analyst: Selected" }));
    await fireEvent.press(dialog.getByRole("button", { name: "Apply speakers" }));
    expect(summary.queryByText("Analyst")).toBeNull();
    expect(summary.getByText("Journalist")).toBeTruthy();
  });

  it("exposes rename, archive, reader edit/delete, and moderation feedback actions", async () => {
    mockEdit.mockImplementation((_input, options) => options.onSuccess());
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const onArchived = jest.fn();
    const screen = await render(<DebateRoomScreen {...bookProps} onArchived={onArchived} windowId={7} />);

    await fireEvent.changeText(await screen.findByDisplayValue("Debate: Meaning"), "New title");
    await fireEvent.press(screen.getByRole("button", { name: "Rename room" }));
    expect(mockRename).toHaveBeenCalledWith({ title: "New title", windowId: 7 });

    await fireEvent.press(screen.getByRole("button", { name: "Edit" }));
    await fireEvent.changeText(screen.getByLabelText("Edit your message"), "Edited reader message");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(mockEdit).toHaveBeenCalledWith(
      { content: "Edited reader message", messageId: 21 },
      expect.any(Object),
    );

    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    alert.mock.calls.at(-1)?.[2]?.[1]?.onPress?.();
    expect(mockDelete).toHaveBeenCalledWith(21);

    await fireEvent.press(screen.getByRole("button", { name: "Related" }));
    expect(mockFeedback).toHaveBeenCalledWith({ eventId: 31, feedback: "RELATED" });

    await fireEvent.press(screen.getByRole("button", { name: "Archive room" }));
    alert.mock.calls.at(-1)?.[2]?.[1]?.onPress?.();
    expect(mockArchive).toHaveBeenCalledWith(7, expect.any(Object));
  });

  it("keeps the current book visible and renders stream deltas outside the live region", async () => {
    const screen = await render(<DebateRoomScreen {...bookProps} onArchived={jest.fn()} windowId={7} />);

    expect(screen.getByTestId("debate-current-book")).toHaveProp("accessibilityLabel", "Current book: Dune, Frank Herbert");
    expect(screen.getByText("Dune · Frank Herbert")).toBeTruthy();
    await act(() => mockOnStreamDelta("First "));
    await act(() => mockOnStreamDelta("second"));
    expect(screen.getByText("First second")).toBeTruthy();
    expect(screen.getByTestId("debate-stream-delta")).toHaveProp("accessibilityLiveRegion", "none");
    expect(screen.getByTestId("debate-stream-delta").props.accessibilityRole).toBeUndefined();

    await fireEvent.changeText(screen.getByLabelText("Persona debate"), "Stream this");
    await fireEvent.press(screen.getByRole("button", { name: "Ask the reading assistant" }));
    await act(() => mockStream.mock.calls[0]?.[1]?.onSuccess());
    expect(screen.getAllByText("The assistant response was saved.")).toHaveLength(1);

    mockStreamError = true;
    await screen.rerender(<DebateRoomScreen {...bookProps} onArchived={jest.fn()} windowId={7} />);
    expect(screen.getAllByText("The authoritative timeline was refreshed. Review it before retrying.")).toHaveLength(1);
  });
});
