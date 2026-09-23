import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

import { ReadingSessionScreen } from "./reading-session-screen";
import * as queries from "./queries";
import type { ReadingSessionTimeline } from "./types";

let mockLocale: "en" | "ko" = "en";
jest.mock("@/shared/i18n/i18n-provider", () => ({ useI18n: () => ({ locale: mockLocale }) }));
jest.mock("./queries");

const timeline: ReadingSessionTimeline = {
  bookId: 4,
  bookTitle: "Dune",
  bookAuthor: "Frank Herbert",
  highlights: [{ highlightId: 3, locationLabel: "p. 3", note: "note", pageNumber: 3, quoteText: "Fear is the mind-killer" }],
  insights: [{ content: "Power shapes ecology", insightId: 5, visibility: "PRIVATE" }],
  messages: [],
  questions: [],
  sessionId: 9,
  stats: { answeredQuestionCount: 0, messageCount: 2, personaCount: 0, personaResponseCount: 0, questionCount: 1, windowCount: 1 },
  tags: [{ label: "ecology", tagId: 4 }],
  title: "Dune notes",
  windows: [],
};

function mutation(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isError: false, isPending: false, mutate: jest.fn(), ...overrides };
}

const updateHighlight = mutation();
const createHighlight = mutation();
const deleteHighlight = mutation();
const deleteTag = mutation();
const updateInsight = mutation();
const deleteInsight = mutation();
const metric = mutation({ data: { highlightCount: 1, messageCount: 2 } });
const createSession = mutation();
const archiveSession = mutation();
const renameSession = mutation();
const createWindow = mutation();
const renameWindow = mutation();
const archiveWindow = mutation();
const createQuestion = mutation();
const deleteQuestion = mutation();
const generateQuestions = mutation();
const streamAnswer = mutation();
const updateMessage = mutation();
const deleteMessage = mutation();
const timelineRefetch = jest.fn();

function renderScreen() {
  const onSearchResult = jest.fn();
  return render(
    <ReadingSessionScreen
      bookId={4}
      bookTitle="Dune"
      onArchived={jest.fn()}
      onDebate={jest.fn()}
      onReflection={jest.fn()}
      onSearchResult={onSearchResult}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = "en";
  jest.mocked(queries.useBookReadingSession).mockReturnValue({ data: { sessionId: 9, title: "Dune notes" }, isError: false, isLoading: false } as ReturnType<typeof queries.useBookReadingSession>);
  jest.mocked(queries.useTimeline).mockReturnValue({ data: timeline, isError: false, isLoading: false, refetch: timelineRefetch } as unknown as ReturnType<typeof queries.useTimeline>);
  jest.mocked(queries.useLatestTimeline).mockReturnValue({ data: timeline, isError: false } as ReturnType<typeof queries.useLatestTimeline>);
  jest.mocked(queries.useSessionSearch).mockImplementation((query) => ({
    data: query ? { query, results: [{ bookId: 8, bookTitle: "Foundation", resultType: "highlight", sessionId: 19, sessionTitle: "Foundation notes", snippet: "Psychohistory", sourceId: 3 }] } : undefined,
    isError: false,
    isFetching: false,
  }) as ReturnType<typeof queries.useSessionSearch>);
  jest.mocked(queries.useCreateHighlight).mockReturnValue(createHighlight as unknown as ReturnType<typeof queries.useCreateHighlight>);
  jest.mocked(queries.useCreateTag).mockReturnValue(mutation() as unknown as ReturnType<typeof queries.useCreateTag>);
  jest.mocked(queries.useCreateInsight).mockReturnValue(mutation() as unknown as ReturnType<typeof queries.useCreateInsight>);
  jest.mocked(queries.useUpdateHighlight).mockReturnValue(updateHighlight as unknown as ReturnType<typeof queries.useUpdateHighlight>);
  jest.mocked(queries.useDeleteHighlight).mockReturnValue(deleteHighlight as unknown as ReturnType<typeof queries.useDeleteHighlight>);
  jest.mocked(queries.useDeleteTag).mockReturnValue(deleteTag as unknown as ReturnType<typeof queries.useDeleteTag>);
  jest.mocked(queries.useUpdateInsight).mockReturnValue(updateInsight as unknown as ReturnType<typeof queries.useUpdateInsight>);
  jest.mocked(queries.useDeleteInsight).mockReturnValue(deleteInsight as unknown as ReturnType<typeof queries.useDeleteInsight>);
  jest.mocked(queries.useMetricSnapshot).mockReturnValue(metric as unknown as ReturnType<typeof queries.useMetricSnapshot>);
  jest.mocked(queries.useCreateReadingSession).mockReturnValue(createSession as unknown as ReturnType<typeof queries.useCreateReadingSession>);
  jest.mocked(queries.useArchiveSession).mockReturnValue(archiveSession as unknown as ReturnType<typeof queries.useArchiveSession>);
  jest.mocked(queries.useUpdateSessionTitle).mockReturnValue(renameSession as unknown as ReturnType<typeof queries.useUpdateSessionTitle>);
  jest.mocked(queries.useCreateSessionWindow).mockReturnValue(createWindow as unknown as ReturnType<typeof queries.useCreateSessionWindow>);
  jest.mocked(queries.useUpdateWindowTitle).mockReturnValue(renameWindow as unknown as ReturnType<typeof queries.useUpdateWindowTitle>);
  jest.mocked(queries.useArchiveWindow).mockReturnValue(archiveWindow as unknown as ReturnType<typeof queries.useArchiveWindow>);
  jest.mocked(queries.useCreateQuestion).mockReturnValue(createQuestion as unknown as ReturnType<typeof queries.useCreateQuestion>);
  jest.mocked(queries.useDeleteQuestion).mockReturnValue(deleteQuestion as unknown as ReturnType<typeof queries.useDeleteQuestion>);
  jest.mocked(queries.useGenerateWindowQuestions).mockReturnValue(generateQuestions as unknown as ReturnType<typeof queries.useGenerateWindowQuestions>);
  jest.mocked(queries.useStreamQuestionAnswer).mockReturnValue(streamAnswer as unknown as ReturnType<typeof queries.useStreamQuestionAnswer>);
  jest.mocked(queries.useUpdateMessage).mockReturnValue(updateMessage as unknown as ReturnType<typeof queries.useUpdateMessage>);
  jest.mocked(queries.useDeleteMessage).mockReturnValue(deleteMessage as unknown as ReturnType<typeof queries.useDeleteMessage>);
});

it("exposes latest, search, and metrics snapshot states", async () => {
  const onSearchResult = jest.fn();
  const view = await render(
    <ReadingSessionScreen
      bookId={4}
      bookTitle="Dune"
      onArchived={jest.fn()}
      onDebate={jest.fn()}
      onReflection={jest.fn()}
      onSearchResult={onSearchResult}
    />,
  );
  expect(view.getByText("Latest reading session")).toBeTruthy();
  await fireEvent.changeText(view.getByLabelText("Search reading memories"), "ritual");
  await fireEvent.press(view.getByRole("button", { name: "Search reading memories" }));
  expect(queries.useSessionSearch).toHaveBeenLastCalledWith("ritual");
  expect(view.getByText(/Foundation notes · Highlight · Psychohistory/)).toBeTruthy();
  await fireEvent.press(view.getByTestId("reading-search-result-19"));
  expect(onSearchResult).toHaveBeenCalledWith(19, 8);
  await fireEvent.press(view.getByText("Save metrics snapshot"));
  expect(metric.mutate).toHaveBeenCalledTimes(1);
  expect(view.getByText("Metrics snapshot saved")).toBeTruthy();
});

// BDD: MOBILE-010 - a same-user session from another book is not rendered or
// mutated under a crafted book route.
it("rejects a timeline that does not belong to the routed book and session", async () => {
  jest.mocked(queries.useTimeline).mockReturnValue({
    data: { ...timeline, bookId: 8, sessionId: 19 },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof queries.useTimeline>);

  const view = await renderScreen();

  expect(view.getByTestId("reading-session-context-error")).toBeTruthy();
  expect(view.queryByTestId("reading-session-screen")).toBeNull();
  expect(view.queryByText("Foundation notes")).toBeNull();
});

it("updates highlights and confirms highlight, tag, and insight deletion", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  });
  const view = await renderScreen();
  await fireEvent.changeText(view.getAllByLabelText("Quoted passage")[1], "Changed quote");
  await fireEvent.press(view.getByLabelText("Update: Fear is the mind-killer"));
  expect(updateHighlight.mutate).toHaveBeenCalledWith(expect.objectContaining({
    highlightId: 3,
    input: expect.objectContaining({ quoteText: "Changed quote" }),
  }));
  await fireEvent.press(view.getByLabelText("Delete: Fear is the mind-killer"));
  await fireEvent.press(view.getByLabelText("Delete: ecology"));
  await fireEvent.press(view.getByLabelText("Delete: Power shapes ecology"));
  expect(alert).toHaveBeenCalledTimes(3);
  expect(deleteHighlight.mutate).toHaveBeenCalledWith(3);
  expect(deleteTag.mutate).toHaveBeenCalledWith(4);
  expect(deleteInsight.mutate).toHaveBeenCalledWith(5);
});

// BDD: FRONT-072
it("filters only the active window messages and saved highlights without mutating records", async () => {
  const searchableTimeline: ReadingSessionTimeline = {
    ...timeline,
    messages: [
      { content: "Alpha in this window", createdAt: "2026-01-01", messageId: 20, messageOrder: 1, role: "assistant", sessionId: 9, streamingStatus: "done", windowId: 6 },
      { content: "Beta in this window", createdAt: "2026-01-01", messageId: 21, messageOrder: 2, role: "assistant", sessionId: 9, streamingStatus: "done", windowId: 6 },
      { content: "Alpha in another window", createdAt: "2026-01-01", messageId: 22, messageOrder: 3, role: "assistant", sessionId: 9, streamingStatus: "done", windowId: 7 },
    ],
    windows: [
      { personaIds: [], position: 0, sessionId: 9, status: "active", title: "Current", windowId: 6, windowType: "reflection" },
      { personaIds: [], position: 1, sessionId: 9, status: "active", title: "Other", windowId: 7, windowType: "reflection" },
    ],
  };
  jest.mocked(queries.useTimeline).mockReturnValue({ data: searchableTimeline, isError: false, isLoading: false } as ReturnType<typeof queries.useTimeline>);
  const view = await renderScreen();

  await fireEvent.changeText(view.getByLabelText("Search this session"), "alpha");
  expect(view.getByText("Alpha in this window")).toBeTruthy();
  expect(view.queryByText("Alpha in another window")).toBeNull();
  expect(view.queryByText("Beta in this window")).toBeNull();
  expect(view.queryByDisplayValue("Fear is the mind-killer")).toBeNull();
  expect(view.getByTestId("session-search-counts")).toHaveTextContent("1 message match · 0 highlight matches");

  await fireEvent.changeText(view.getByLabelText("Search this session"), "page 404");
  expect(view.getByText("No messages or highlights match this session search.")).toBeTruthy();
  expect(searchableTimeline.messages).toHaveLength(3);
  expect(searchableTimeline.highlights).toHaveLength(1);
});

// BDD: FRONT-077
// BDD: FRONT-078
it("accepts only optional positive whole-number pages for highlight create and edit", async () => {
  const view = await renderScreen();
  const [newPage, savedPage] = view.getAllByLabelText("Page number");

  await fireEvent.changeText(view.getAllByLabelText("Quoted passage")[0], "A new quote");
  await fireEvent.changeText(newPage, "1.5");
  expect(view.getByTestId("create-highlight").props.accessibilityState.disabled).toBe(true);
  expect(view.getByText("Enter a positive whole-number page.")).toBeTruthy();
  await fireEvent.changeText(newPage, "8");
  await fireEvent.press(view.getByTestId("create-highlight"));
  expect(createHighlight.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ pageNumber: 8, quoteText: "A new quote" }),
    expect.any(Object),
  );

  await fireEvent.changeText(savedPage, "-2");
  expect(view.getByTestId("update-highlight-3").props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(savedPage, "13");
  await fireEvent.press(view.getByTestId("update-highlight-3"));
  expect(updateHighlight.mutate).toHaveBeenCalledWith(expect.objectContaining({
    highlightId: 3,
    input: expect.objectContaining({ pageNumber: 13 }),
  }));
});

// BDD: FRONT-022
it("uses result-shaped placeholders for reading-memory search and question generation", async () => {
  jest.mocked(queries.useSessionSearch).mockReturnValue({ data: undefined, isError: false, isFetching: true } as ReturnType<typeof queries.useSessionSearch>);
  jest.mocked(queries.useGenerateWindowQuestions).mockReturnValue({ ...generateQuestions, isPending: true } as unknown as ReturnType<typeof queries.useGenerateWindowQuestions>);
  jest.mocked(queries.useTimeline).mockReturnValue({
    data: { ...timeline, windows: [{ personaIds: [], position: 0, sessionId: 9, status: "active", title: "Current", windowId: 6, windowType: "reflection" }] },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof queries.useTimeline>);
  const view = await renderScreen();

  expect(view.getByTestId("reading-memory-search-skeleton")).toHaveProp("accessibilityRole", "progressbar");
  expect(view.getByTestId("question-generation-skeleton")).toHaveProp("accessibilityRole", "progressbar");
});

// BDD: FRONT-113
it("visibly labels persisted assistant responses with their generated message id", async () => {
  jest.mocked(queries.useTimeline).mockReturnValue({
    data: {
      ...timeline,
      messages: [{ content: "Persisted answer", createdAt: "2026-01-01", messageId: 73, messageOrder: 1, role: "assistant", sessionId: 9, streamingStatus: "done", windowId: 6 }],
      windows: [{ personaIds: [], position: 0, sessionId: 9, status: "active", title: "Current", windowId: 6, windowType: "reflection" }],
    },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof queries.useTimeline>);
  const view = await renderScreen();

  expect(view.getByText("Reading assistant · Message ID 73")).toBeTruthy();
  expect(view.getByText("Persisted answer")).toBeTruthy();
});

// BDD: FRONT-052
it("offers an explicit retry after initial timeline restore fails", async () => {
  const refetchSession = jest.fn();
  const refetchTimeline = jest.fn();
  jest.mocked(queries.useBookReadingSession).mockReturnValue({ data: { sessionId: 9, title: "Dune notes" }, isError: false, isLoading: false, refetch: refetchSession } as unknown as ReturnType<typeof queries.useBookReadingSession>);
  jest.mocked(queries.useTimeline).mockReturnValue({ data: undefined, isError: true, isLoading: false, refetch: refetchTimeline } as unknown as ReturnType<typeof queries.useTimeline>);
  const view = await renderScreen();

  await fireEvent.press(view.getByRole("button", { name: "Retry" }));

  expect(refetchSession).toHaveBeenCalledTimes(1);
  expect(refetchTimeline).toHaveBeenCalledTimes(1);
});

// BDD: FRONT-047
it("starts a backend reading session when the saved book has none", async () => {
  jest.mocked(queries.useBookReadingSession).mockReturnValue({ data: null, isError: false, isLoading: false } as ReturnType<typeof queries.useBookReadingSession>);
  jest.mocked(queries.useTimeline).mockReturnValue({ data: undefined, isError: false, isLoading: false } as ReturnType<typeof queries.useTimeline>);
  const view = await renderScreen();

  await fireEvent.press(view.getByTestId("create-reading-session"));

  expect(createSession.mutate).toHaveBeenCalledWith("Dune");
});

// BDD: FRONT-025
it("starts another backend session without searching for the saved book again", async () => {
  const view = await renderScreen();

  await fireEvent.press(view.getByTestId("create-another-reading-session"));

  expect(createSession.mutate).toHaveBeenCalledWith("Dune");
});

// BDD: FRONT-102
it("exposes tap-ready jump controls for every long reading-session work area", async () => {
  const view = await renderScreen();

  expect(view.getByTestId("reading-area-jump-controls")).toHaveStyle({
    flexDirection: "row",
    flexWrap: "wrap",
  });
  for (const area of ["questions", "progress", "quotes", "messages", "review"]) {
    const control = view.getByTestId(`reading-area-jump-${area}`);
    expect(control).toHaveStyle({ flexBasis: "30%", flexGrow: 1 });
    expect(view.getByTestId(`reading-area-${area}`)).toBeTruthy();
  }
});

// BDD: FRONT-056, FRONT-057, FRONT-058, FRONT-060, FRONT-061, FRONT-090, FRONT-092, FRONT-093, FRONT-116, FRONT-119
// BDD: FRONT-061
// BDD: FRONT-090
// BDD: FRONT-092
// BDD: FRONT-093
it("manages the selected reflection window, questions, streamed answer, and reader message", async () => {
  const richTimeline: ReadingSessionTimeline = {
    ...timeline,
    messages: [
      { content: "Saved answer", createdAt: "2026-01-01", messageId: 20, messageOrder: 1, questionId: 11, role: "user", sessionId: 9, streamingStatus: "done", windowId: 6 },
      { content: "AI reply", createdAt: "2026-01-01", messageId: 21, messageOrder: 2, questionId: 11, role: "assistant", sessionId: 9, streamingStatus: "done", windowId: 6 },
    ],
    questions: [
      { questionId: 11, questionText: "What changed?", questionType: "generated", sessionId: 9, status: "answered", windowId: 6 },
      { questionId: 12, questionText: "What remains?", questionType: "generated", sessionId: 9, status: "open", windowId: 6 },
    ],
    windows: [{ personaIds: [], position: 0, sessionId: 9, status: "active", title: "Identity", windowId: 6, windowType: "question" }],
  };
  jest.mocked(queries.useTimeline).mockReturnValue({ data: richTimeline, isError: false, isLoading: false } as ReturnType<typeof queries.useTimeline>);
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => buttons?.find((button) => button.style === "destructive")?.onPress?.());
  const view = await renderScreen();

  await fireEvent.changeText(view.getByLabelText("Question focus (optional)"), "power");
  await fireEvent.press(view.getByRole("button", { name: "Generate questions" }));
  expect(generateQuestions.mutate).toHaveBeenCalledWith({ focus: "bookId=4; title=Dune; author=Frank Herbert; focus=power", windowId: 6 });

  await fireEvent.press(view.getByTestId("reading-question-11"));
  expect(view.getByText("You: Saved answer")).toBeTruthy();
  await fireEvent.changeText(view.getByLabelText("Answer selected question"), "A new answer");
  await fireEvent.press(view.getByRole("button", { name: "Answer selected question" }));
  expect(streamAnswer.mutate).toHaveBeenCalledWith(expect.objectContaining({ content: "A new answer", questionId: 11, windowId: 6 }), expect.any(Object));
  expect(view.getByText("You: A new answer")).toBeTruthy();
  await act(async () => streamAnswer.mutate.mock.calls[0]?.[0]?.onDelta("Partial assistant reply"));
  expect(view.getByTestId("reading-stream-delta")).toHaveProp("accessibilityLiveRegion", "none");
  expect(view.getByTestId("reading-stream-delta").props.accessibilityRole).toBeUndefined();
  await act(async () => streamAnswer.mutate.mock.calls[0]?.[1]?.onSuccess());
  expect(view.queryByTestId("reading-stream-delta")).toBeNull();
  expect(view.getAllByText("The assistant response was saved.")).toHaveLength(1);

  await fireEvent.press(view.getByRole("button", { name: "Unanswered" }));
  expect(view.queryByTestId("reading-question-11")).toBeNull();
  await fireEvent.press(view.getByLabelText("Delete: What remains?"));
  expect(alert).toHaveBeenCalled();
  expect(deleteQuestion.mutate).toHaveBeenCalledWith(12);

  await fireEvent.changeText(view.getByLabelText("Conversation timeline #20"), "Edited answer");
  await fireEvent.press(view.getByLabelText("Update: Saved answer"));
  expect(updateMessage.mutate).toHaveBeenCalledWith({ content: "Edited answer", messageId: 20 });
});

it("localizes reading counters, result types, window state, question state, and message roles in Korean", async () => {
  mockLocale = "ko";
  jest.mocked(queries.useTimeline).mockReturnValue({
    data: {
      ...timeline,
      messages: [{ content: "AI reply", createdAt: "2026-01-01", messageId: 21, messageOrder: 1, role: "assistant", sessionId: 9, streamingStatus: "done", windowId: 6 }],
      questions: [
        { questionId: 12, questionText: "What remains?", questionType: "generated", sessionId: 9, status: "open", windowId: 6 },
        { questionId: 13, questionText: "What changed?", questionType: "generated", sessionId: 9, status: "answered", windowId: 6 },
      ],
      stats: { ...timeline.stats, messageCount: 1, questionCount: 2, windowCount: 1 },
      windows: [{ personaIds: [], position: 0, sessionId: 9, status: "active", title: "Identity", windowId: 6, windowType: "question" }],
    },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof queries.useTimeline>);
  const view = await renderScreen();

  expect(view.getByText("1개 창 · 2개 질문 · 1개 메시지")).toBeTruthy();
  expect(view.getByText("질문 창 · 진행 중")).toBeTruthy();
  expect(view.getByText("What remains? · 미답변")).toBeTruthy();
  expect(view.getByText("독서 도우미 · 메시지 ID 21")).toBeTruthy();
  expect(view.getByText("1개 하이라이트 · 2개 메시지")).toBeTruthy();
});

it("keeps legacy questions with a null status available as unanswered", async () => {
  jest.mocked(queries.useTimeline).mockReturnValue({
    data: {
      ...timeline,
      questions: [
        { questionId: 12, questionText: "What remains?", questionType: "generated", sessionId: 9, status: null, windowId: 6 },
      ],
      windows: [{ personaIds: [], position: 0, sessionId: 9, status: "active", title: "Identity", windowId: 6, windowType: "question" }],
    },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof queries.useTimeline>);
  const view = await renderScreen();

  expect(view.getByText("What remains? · Status unavailable")).toBeTruthy();
  await fireEvent.press(view.getByRole("button", { name: "Unanswered" }));
  expect(view.getByTestId("reading-question-12")).toBeTruthy();
});

it("clears partial stream output, preserves the draft, and reloads authority after interruption", async () => {
  jest.mocked(queries.useTimeline).mockReturnValue({
    data: {
      ...timeline,
      questions: [{ questionId: 11, questionText: "What changed?", questionType: "generated", sessionId: 9, status: "open", windowId: 6 }],
      windows: [{ personaIds: [], position: 0, sessionId: 9, status: "active", title: "Identity", windowId: 6, windowType: "question" }],
    },
    isError: false,
    isLoading: false,
    refetch: timelineRefetch,
  } as unknown as ReturnType<typeof queries.useTimeline>);
  const view = await renderScreen();

  await fireEvent.press(view.getByTestId("reading-question-11"));
  await fireEvent.changeText(view.getByLabelText("Answer selected question"), "Keep this draft");
  await fireEvent.press(view.getByRole("button", { name: "Answer selected question" }));
  const [variables, callbacks] = streamAnswer.mutate.mock.calls[0];
  await act(async () => variables.onDelta("Partial reply"));
  expect(view.getByText("Partial reply")).toBeTruthy();

  await act(async () => callbacks.onError(new Error("aborted")));
  expect(view.queryByTestId("reading-stream-delta")).toBeNull();
  expect(view.getByDisplayValue("Keep this draft")).toBeTruthy();
  expect(view.getAllByText("Could not load or update this reading record.")).toHaveLength(1);
  expect(timelineRefetch).toHaveBeenCalledTimes(1);
  expect(variables.signal).toBeInstanceOf(AbortSignal);
});

it("aborts an in-flight answer stream when the screen unmounts", async () => {
  jest.mocked(queries.useTimeline).mockReturnValue({
    data: {
      ...timeline,
      questions: [{ questionId: 11, questionText: "What changed?", questionType: "generated", sessionId: 9, status: "open", windowId: 6 }],
      windows: [{ personaIds: [], position: 0, sessionId: 9, status: "active", title: "Identity", windowId: 6, windowType: "question" }],
    },
    isError: false,
    isLoading: false,
    refetch: timelineRefetch,
  } as unknown as ReturnType<typeof queries.useTimeline>);
  const view = await renderScreen();

  await fireEvent.press(view.getByTestId("reading-question-11"));
  await fireEvent.changeText(view.getByLabelText("Answer selected question"), "Stop on exit");
  await fireEvent.press(view.getByRole("button", { name: "Answer selected question" }));
  const signal = streamAnswer.mutate.mock.calls[0]?.[0]?.signal as AbortSignal;
  expect(signal.aborted).toBe(false);
  await act(async () => view.unmount());
  expect(signal.aborted).toBe(true);
});
