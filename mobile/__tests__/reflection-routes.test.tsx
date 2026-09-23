import { act, fireEvent, render } from "@testing-library/react-native";

import ReflectionRoute from "@/app/(protected)/books/[bookId]/reflection";
import InterviewRoute from "@/app/(protected)/books/[bookId]/reflection/interview";
import { ApiRequestError } from "@/shared/api/error";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockInterviewScreen = jest.fn();
const mockReflectionScreen = jest.fn();
let mockParams: Record<string, string | undefined> = {};
let mockBookQuery: Record<string, unknown>;

jest.mock("expo-router", () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: () => false,
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));
jest.mock("@/features/books/queries", () => ({
  useBookQuery: () => mockBookQuery,
}));
jest.mock("@/features/reflections/screens", () => ({
  InterviewScreen: (props: { interviewId: number }) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
    mockInterviewScreen(props);
    const [localValue, setLocalValue] = React.useState(`interview-${props.interviewId}`);
    return React.createElement(
      Pressable,
      { onPress: () => setLocalValue("dirty"), testID: "mock-interview-local-state" },
      React.createElement(Text, null, localValue),
    );
  },
  ReflectionScreen: (props: unknown) => {
    mockReflectionScreen(props);
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockBookQuery = {
    data: { author: "Author", title: "Book" },
    error: null,
    isError: false,
    isLoading: false,
    refetch: jest.fn(),
  };
});

// BDD: RLOOP-042
it("links interview evidence to the exact authority-scoped source revision", async () => {
  mockParams = { bookId: "3", interviewId: "12", sessionId: "5" };
  await render(<InterviewRoute />);
  const props = mockInterviewScreen.mock.calls[0][0];

  await act(async () => props.onSourceRevision(18));

  expect(mockPush).toHaveBeenCalledWith(
    "/books/3/reflection?sessionId=5&revisionId=18",
  );
});

it("remounts local interview state when restart replaces the route with a new interview", async () => {
  mockParams = { bookId: "3", interviewId: "12", sessionId: "5" };
  const view = await render(<InterviewRoute />);
  await fireEvent.press(view.getByTestId("mock-interview-local-state"));
  expect(view.getByText("dirty")).toBeTruthy();

  mockParams = { bookId: "3", interviewId: "13", sessionId: "5" };
  await view.rerender(<InterviewRoute />);

  expect(view.getByText("interview-13")).toBeTruthy();
  expect(view.queryByText("dirty")).toBeNull();
});

it("passes only a valid revision target to the Reflection screen and closes canonically", async () => {
  mockParams = { bookId: "3", revisionId: "18", sessionId: "5" };
  await render(<ReflectionRoute />);
  const props = mockReflectionScreen.mock.calls[0][0];

  expect(props.sourceRevisionId).toBe(18);
  await act(async () => props.onCloseSourceRevision());
  expect(mockReplace).toHaveBeenCalledWith("/books/3/reflection?sessionId=5");
});

it("gives Reflection a safe fallback when a direct link has no native history", async () => {
  mockParams = { bookId: "3", sessionId: "5" };
  await render(<ReflectionRoute />);
  const props = mockReflectionScreen.mock.calls[0][0];

  await act(async () => props.onBack());

  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith("/reflection");
});

// BDD: RLOOP-057, MOBILE-019
it("maps persisted Reflection Loop targets to their exact native routes", async () => {
  mockParams = { bookId: "3", sessionId: "5" };
  await render(<ReflectionRoute />);
  const props = mockReflectionScreen.mock.calls[0][0];

  await act(async () => props.onWorkflow({ id: 12, kind: "interview" }));
  await act(async () => props.onWorkflow({ id: 13, kind: "guide" }));
  await act(async () => props.onWorkflow({ id: 14, kind: "discuss" }));
  await act(async () => props.onWorkflow({ id: 14, kind: "refine" }));

  expect(mockPush.mock.calls).toEqual([
    ["/books/3/reflection/interview?interviewId=12&sessionId=5"],
    ["/books/3/reflection/guide/13"],
    ["/books/3/reflection/discuss/14"],
    ["/books/3/reflection/refine/14"],
  ]);
});

it("fails closed before mounting Reflection content for an invalid revision target", async () => {
  mockParams = { bookId: "3", revisionId: "not-a-number", sessionId: "5" };
  await render(<ReflectionRoute />);

  expect(mockReflectionScreen).not.toHaveBeenCalled();
});

it("offers a retry instead of treating a book network failure as not found", async () => {
  const refetch = jest.fn();
  mockBookQuery = {
    data: undefined,
    error: new Error("offline"),
    isError: true,
    isLoading: false,
    refetch,
  };
  mockParams = { bookId: "3", sessionId: "5" };
  const screen = await render(<ReflectionRoute />);

  expect(
    screen.getByText("Could not load or update this reflection workflow."),
  ).toBeTruthy();
  expect(
    screen.queryByText("This reflection workflow was not found for this book."),
  ).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it("keeps a missing route book fail-closed without a retry mutation", async () => {
  mockBookQuery = {
    data: undefined,
    error: new ApiRequestError({ code: "BOOK_NOT_FOUND", status: 404 }),
    isError: true,
    isLoading: false,
    refetch: jest.fn(),
  };
  mockParams = { bookId: "3", sessionId: "5" };
  const screen = await render(<ReflectionRoute />);

  expect(
    screen.getByText("This reflection workflow was not found for this book."),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  expect(mockReflectionScreen).not.toHaveBeenCalled();
});
