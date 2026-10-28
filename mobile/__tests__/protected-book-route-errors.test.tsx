import { fireEvent, render } from "@testing-library/react-native";

import { ResolvedDebateRoomRoute } from "@/app/(protected)/books/[bookId]/debates/[windowId]";
import { ResolvedReadingSessionRoute } from "@/app/(protected)/books/[bookId]/session";

const refetch = jest.fn();
let mockBookQuery: Record<string, unknown>;

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => false,
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));
jest.mock("@/features/books/queries", () => ({
  useBookQuery: () => mockBookQuery,
}));
jest.mock("@/features/debates/screens", () => ({ DebateRoomScreen: () => null }));
jest.mock("@/features/reading-sessions/reading-session-screen", () => ({
  ReadingSessionScreen: () => null,
}));
jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockBookQuery = {
    data: undefined,
    isError: true,
    isLoading: false,
    refetch,
  };
});

it("keeps a Debate room book load failure retryable instead of calling it missing", async () => {
  const view = await render(<ResolvedDebateRoomRoute bookId={4} windowId={9} />);

  expect(view.getByText("Could not load this debate room.")).toBeTruthy();
  expect(view.queryByText("Debate room not found.")).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "Try again" }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it("keeps a Reading workspace book load failure retryable instead of calling it empty", async () => {
  const view = await render(<ResolvedReadingSessionRoute bookId={4} />);

  expect(view.getByText("Could not load or update this reading record.")).toBeTruthy();
  expect(view.queryByText("No reading session is available yet.")).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "Retry" }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it("shows not-found only after the owned book collection loaded successfully", async () => {
  mockBookQuery = {
    data: undefined,
    isError: false,
    isLoading: false,
    refetch,
  };
  const view = await render(<ResolvedDebateRoomRoute bookId={4} windowId={9} />);

  expect(view.getByText("Debate room not found.")).toBeTruthy();
  expect(view.queryByRole("button", { name: "Try again" })).toBeNull();
});
