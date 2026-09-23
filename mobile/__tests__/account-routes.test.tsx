import { act, render } from "@testing-library/react-native";
import { Linking } from "react-native";

import AccountRoute from "@/app/(protected)/(tabs)/account";
import ConsentAccountRoute from "@/app/consent-account";

const mockPush = jest.fn();
const mockAccountScreen = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockRefreshSession = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));
jest.mock("@/features/auth/session-provider", () => ({
  useAuthSession: () => ({
    logout: mockLogout,
    refreshSession: mockRefreshSession,
    session: { membershipTier: "PREMIUM" },
  }),
}));
jest.mock("@/features/account/account-screen", () => ({
  AccountScreen: (props: unknown) => {
    mockAccountScreen(props);
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// BDD: ACCOUNT-012
// BDD: TERM-021
it.each([
  ["protected", AccountRoute],
  ["consent-required", ConsentAccountRoute],
])("wires real privacy and support destinations from the %s account route", async (_name, Route) => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await render(<Route />);
  const props = mockAccountScreen.mock.calls[0][0] as {
    membershipTier?: string;
    onContactSupport(): Promise<void>;
    onOpenPrivacy(): void;
    onOpenPrivacyHistory(): void;
    onOpenTerms(): void;
    onOpenTermsHistory(): void;
  };

  expect(props.membershipTier).toBe("PREMIUM");
  await act(async () => props.onOpenPrivacy());
  await act(async () => props.onOpenPrivacyHistory());
  await act(async () => props.onOpenTerms());
  await act(async () => props.onOpenTermsHistory());
  await act(async () => props.onContactSupport());

  expect(mockPush).toHaveBeenNthCalledWith(1, "/privacy");
  expect(mockPush).toHaveBeenNthCalledWith(2, "/privacy-history");
  expect(mockPush).toHaveBeenNthCalledWith(3, "/terms");
  expect(mockPush).toHaveBeenNthCalledWith(4, "/terms-history");
  expect(open).toHaveBeenCalledWith("mailto:support@margins.cloud");
});
