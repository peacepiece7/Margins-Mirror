import { act, render } from "@testing-library/react-native";
import { Linking } from "react-native";

import TermsHistoryRoute from "@/app/terms-history";
import TermsRoute from "@/app/terms";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockTermsHistoryScreen = jest.fn();
const mockTermsScreen = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));
jest.mock("@/features/service-terms/terms-screen", () => ({
  TermsHistoryScreen: (props: unknown) => {
    mockTermsHistoryScreen(props);
    return null;
  },
  TermsScreen: (props: unknown) => {
    mockTermsScreen(props);
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// BDD: TERM-021
it("wires the public current Terms route to history, Privacy, and support", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await render(<TermsRoute />);
  const props = mockTermsScreen.mock.calls[0][0] as {
    onContact(): void;
    onOpenHistory(): void;
    onOpenPrivacy(): void;
  };

  await act(async () => props.onOpenHistory());
  await act(async () => props.onOpenPrivacy());
  await act(async () => props.onContact());

  expect(mockPush).toHaveBeenNthCalledWith(1, "/terms-history");
  expect(mockPush).toHaveBeenNthCalledWith(2, "/privacy");
  expect(open).toHaveBeenCalledWith("mailto:support@margins.cloud");
});

// BDD: TERM-021
it("wires the public history route back to current Terms", async () => {
  await render(<TermsHistoryRoute />);
  const props = mockTermsHistoryScreen.mock.calls[0][0] as {
    onOpenCurrent(): void;
    onOpenPrivacy(): void;
  };

  await act(async () => props.onOpenCurrent());
  await act(async () => props.onOpenPrivacy());

  expect(mockReplace).toHaveBeenCalledWith("/terms");
  expect(mockPush).toHaveBeenCalledWith("/privacy");
});
