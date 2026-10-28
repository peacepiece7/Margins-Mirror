import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ConsentScreen } from "./consent-screen";

const mockGrant = jest.fn();
const mockRequirements = jest.fn();
const mockStatus = jest.fn();
let mockLocale: "en" | "ko" = "en";

jest.mock("@/shared/api/api-client-provider", () => ({
  useApiClient: () => ({}),
}));
jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: mockLocale }),
}));
jest.mock("./api", () => ({
  createPrivacyApi: () => ({
    grant: mockGrant,
    requirements: mockRequirements,
    status: mockStatus,
  }),
}));

function renderConsent(props: {
  logout?: () => Promise<void>;
  onOpenAccount?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  refreshSession: () => Promise<void>;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConsentScreen
        logout={props.logout ?? jest.fn()}
        onOpenAccount={props.onOpenAccount ?? jest.fn()}
        onOpenPrivacy={props.onOpenPrivacy ?? jest.fn()}
        onOpenTerms={props.onOpenTerms ?? jest.fn()}
        refreshSession={props.refreshSession}
      />
    </QueryClientProvider>,
  );
}

describe("ConsentScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocale = "en";
    mockRequirements.mockResolvedValue({
      aiTransferVersion: "2026-07-27",
      minimumAge: 14,
      privacyPolicyVersion: "2026-07-27",
    });
    mockStatus.mockResolvedValue({
      consentRequired: true,
      missingConsentTypes: ["PRIVACY", "AI", "AGE"],
    });
    mockGrant.mockResolvedValue({
      consentRequired: false,
      missingConsentTypes: [],
    });
  });

  it("does not append consent again when only the session refresh is retried", async () => {
    const refreshSession = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const screen = await renderConsent({ refreshSession });

    for (const name of [
      "I accept the privacy policy.",
      "I consent to the documented AI data transfer.",
      "I confirm I meet the minimum age requirement. (14+)",
    ]) {
      await fireEvent.press(await screen.findByRole("checkbox", { name }));
    }
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText(/Consent was saved, but the session/);
    expect(mockGrant).toHaveBeenCalledTimes(1);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Missing consent: Accepted")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "I accept the privacy policy." }).props
        .accessibilityState,
    ).toMatchObject({ checked: true, disabled: true });

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(2));
    expect(mockGrant).toHaveBeenCalledTimes(1);
  });

  it("blocks consent when the backend requires policy text absent from this build", async () => {
    mockRequirements.mockResolvedValue({
      aiTransferVersion: "2026-09-01",
      minimumAge: 14,
      privacyPolicyVersion: "2026-09-01",
    });
    const screen = await renderConsent({ refreshSession: jest.fn() });

    expect(
      await screen.findByText(
        "A newer consent policy is required. Update Margins before accepting it.",
      ),
    ).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it("resumes with refresh only when consent is already current after a remount", async () => {
    mockStatus.mockResolvedValue({
      consentRequired: false,
      missingConsentTypes: [],
    });
    const refreshSession = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const screen = await renderConsent({ refreshSession });

    const privacyConsent = await screen.findByRole("checkbox", {
      name: "I accept the privacy policy.",
    });
    expect(privacyConsent.props.accessibilityState).toMatchObject({
      checked: true,
      disabled: true,
    });

    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1));
    expect(mockGrant).not.toHaveBeenCalled();
  });

  // BDD: PRIVACY-006, PRIVACY-010
  // BDD: TERM-021
  it("keeps the recovered-user consent, account, privacy, and logout actions in Korean", async () => {
    mockLocale = "ko";
    const onOpenAccount = jest.fn();
    const onOpenPrivacy = jest.fn();
    const logout = jest.fn().mockResolvedValue(undefined);
    const screen = await renderConsent({
      logout,
      onOpenAccount,
      onOpenPrivacy,
      refreshSession: jest.fn(),
    });

    expect(await screen.findByRole("button", { name: "계정 및 탈퇴" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "개인정보처리방침 읽기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "서비스 이용약관 읽기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();
    expect(screen.queryByText("Consent required")).toBeNull();
  });
});
