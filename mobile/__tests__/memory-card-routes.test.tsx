import { fireEvent, render } from "@testing-library/react-native";

import MemoryCardGroupRoute from "@/app/(protected)/memory-cards/[groupId]";
import MemoryCardStudyRoute from "@/app/(protected)/memory-cards/[groupId]/study";
import MemoryCardGroupsRoute from "@/app/(protected)/memory-cards";

// BDD: MEM-004
// BDD: MEM-009
// BDD: MEM-002

const mockRedirect = jest.fn();
const mockReplace = jest.fn();
const mockGroupsScreen = jest.fn();
const mockGroupScreen = jest.fn();
const mockBookRefetch = jest.fn();
let mockParams: { bookId?: string; groupId?: string } = { groupId: "7" };
let mockSession: { membershipTier: "FREE" | "PREMIUM" } | undefined = { membershipTier: "FREE" };
let mockBookQuery: Record<string, unknown>;

jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props);
    return null;
  },
  router: {
    back: jest.fn(),
    canGoBack: () => false,
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/features/auth/session-provider", () => ({
  useAuthSession: () => ({ session: mockSession }),
}));
jest.mock("@/features/books/queries", () => ({
  useBookQuery: () => mockBookQuery,
}));
jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en", t: (key: string) => ({ bookNotFound: "Book not found", selectedBook: "Selected book", studyNav: "Study" })[key] ?? key }),
}));

jest.mock("@/features/memory-cards/groups-screen", () => ({
  MemoryCardGroupsScreen: (props: unknown) => {
    mockGroupsScreen(props);
    return null;
  },
}));

jest.mock("@/features/memory-cards/group-screen", () => ({
  MemoryCardGroupScreen: (props: unknown) => {
    mockGroupScreen(props);
    return null;
  },
}));

describe("protected Memory Card routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { groupId: "7" };
    mockSession = { membershipTier: "FREE" };
    mockBookQuery = {
      data: { bookId: 7, title: "Dune" },
      isError: false,
      isLoading: false,
      refetch: mockBookRefetch,
    };
  });

  it.each([
    ["group", MemoryCardGroupRoute],
    ["study", MemoryCardStudyRoute],
  ])("shows a FREE user's direct %s route as an explanatory gate without protected data", async (name, Route) => {
    await render(<Route />);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockGroupsScreen).not.toHaveBeenCalled();
    expect(mockGroupScreen).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 7,
        ...(name === "study" ? { mode: "study" } : {}),
        premium: false,
      }),
    );
    const props = mockGroupScreen.mock.calls[0][0] as { onBack(): void };
    props.onBack();
    expect(mockReplace).toHaveBeenCalledWith("/library");
  });

  it("shows the explanatory FREE gate at the Study root without mounting protected data", async () => {
    await render(<MemoryCardGroupsRoute />);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockGroupsScreen).toHaveBeenCalledWith(
      expect.objectContaining({ premium: false }),
    );
    const props = mockGroupsScreen.mock.calls[0][0] as { onBack(): void };
    props.onBack();
    expect(mockReplace).toHaveBeenCalledWith("/library");
  });

  it("requires a selected valid book before a PREMIUM root list opens", async () => {
    mockSession = { membershipTier: "PREMIUM" };
    await render(<MemoryCardGroupsRoute />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: "/library?action=study" });

    jest.clearAllMocks();
    mockParams = { bookId: "not-a-book" };
    const invalid = await render(<MemoryCardGroupsRoute />);
    expect(invalid.getByText("Book not found")).toBeTruthy();
    expect(mockGroupsScreen).not.toHaveBeenCalled();
    await fireEvent.press(invalid.getByRole("button", { name: "Back to Library" }));
    expect(mockReplace).toHaveBeenCalledWith("/library?action=study");
  });

  it("opens only the selected book's groups for a PREMIUM user", async () => {
    mockSession = { membershipTier: "PREMIUM" };
    mockParams = { bookId: "7" };

    await render(<MemoryCardGroupsRoute />);

    expect(mockGroupsScreen).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: 7,
        contextLabel: "Selected book: Dune",
        premium: true,
      }),
    );
  });

  it("keeps a selected-book network failure retryable", async () => {
    mockSession = { membershipTier: "PREMIUM" };
    mockParams = { bookId: "7" };
    mockBookQuery = {
      data: undefined,
      isError: true,
      isLoading: false,
      refetch: mockBookRefetch,
    };

    const view = await render(<MemoryCardGroupsRoute />);

    expect(view.getByText("Memory Cards could not be loaded or saved.")).toBeTruthy();
    expect(view.queryByText("Book not found")).toBeNull();
    await fireEvent.press(view.getByRole("button", { name: "Try again" }));
    expect(mockBookRefetch).toHaveBeenCalledTimes(1);
  });

  it("keeps direct group and study routes available to a PREMIUM user", async () => {
    mockSession = { membershipTier: "PREMIUM" };

    await render(<MemoryCardGroupRoute />);
    await render(<MemoryCardStudyRoute />);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockGroupScreen).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ groupId: 7, premium: true }),
    );
    expect(mockGroupScreen).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ groupId: 7, mode: "study", premium: true }),
    );

    const groupProps = mockGroupScreen.mock.calls[0][0] as { onBack(): void };
    groupProps.onBack();
    expect(mockReplace).toHaveBeenCalledWith("/library?action=study");

    const studyProps = mockGroupScreen.mock.calls[1][0] as { onBack(): void };
    studyProps.onBack();
    expect(mockReplace).toHaveBeenCalledWith("/memory-cards/7");
  });
});
