import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { ApiRequestError } from "@/shared/api/error";
import { AccountScreen } from "./account-screen";

const mockSetLocale = jest.fn();
let mockLocale: "en" | "ko" = "en";

const mockPassword = {
  isPending: false,
  mutateAsync: jest.fn(),
};
const mockProfile = {
  isPending: false,
  mutateAsync: jest.fn(),
};
const mockChallenge = {
  data: undefined as
    | undefined
    | { challengeId: string; devVerificationCode?: string },
  isPending: false,
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
};
const mockVerifyResignation = {
  data: undefined as undefined | { actionToken: string; expiresInSeconds: number },
  isPending: false,
  mutateAsync: jest.fn(),
  reset: jest.fn(),
};
const mockResign = {
  isPending: false,
  mutateAsync: jest.fn(),
};
const mockAccountData = {
  accountStatus: "ACTIVE",
  authProvider: "local",
  displayName: "Reader",
  email: "reader@example.com",
  preferredLocale: "en",
  userId: 1,
  username: "reader",
};
const mockAccountQuery: {
  data: typeof mockAccountData | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: jest.Mock;
} = {
  data: mockAccountData,
  isError: false,
  isPending: false,
  refetch: jest.fn(),
};

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: mockLocale, setLocale: mockSetLocale }),
}));
jest.mock("./queries", () => ({
  useAccountMutations: () => ({
    challenge: mockChallenge,
    password: mockPassword,
    profile: mockProfile,
    resign: mockResign,
    verifyResignation: mockVerifyResignation,
  }),
  useAccountQuery: () => mockAccountQuery,
}));

function accountProps(
  overrides: Partial<Parameters<typeof AccountScreen>[0]> = {},
): Parameters<typeof AccountScreen>[0] {
  return {
    logout: jest.fn().mockResolvedValue(undefined),
    onContactSupport: jest.fn().mockResolvedValue(undefined),
    onOpenPrivacy: jest.fn(),
    onOpenPrivacyHistory: jest.fn(),
    onOpenTerms: jest.fn(),
    onOpenTermsHistory: jest.fn(),
    refreshSession: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("AccountScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocale = "en";
    Object.assign(mockAccountData, {
      accountStatus: "ACTIVE",
      authProvider: "local",
      displayName: "Reader",
      email: "reader@example.com",
      preferredLocale: "en",
      userId: 1,
      username: "reader",
    });
    Object.assign(mockAccountQuery, {
      data: mockAccountData,
      isError: false,
      isPending: false,
    });
    mockAccountQuery.refetch.mockResolvedValue(undefined);
    mockChallenge.data = undefined;
    mockVerifyResignation.data = undefined;
    mockPassword.mutateAsync.mockResolvedValue(undefined);
    mockProfile.mutateAsync.mockImplementation(
      async ({ displayName, preferredLocale }) => {
        Object.assign(mockAccountData, { displayName, preferredLocale });
        return { account: { ...mockAccountData } };
      },
    );
    mockChallenge.mutateAsync.mockResolvedValue(undefined);
    mockVerifyResignation.mutateAsync.mockImplementation(async () => {
      const result = { actionToken: "verified", expiresInSeconds: 300 };
      mockVerifyResignation.data = result;
      return result;
    });
    mockVerifyResignation.reset.mockImplementation(() => {
      mockVerifyResignation.data = undefined;
    });
    mockResign.mutateAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("ends the local session after a successful password change", async () => {
    const logout = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <AccountScreen {...accountProps({ logout })} />,
    );

    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "old-password",
    );
    await fireEvent.changeText(
      screen.getByLabelText("New password"),
      "new-password-123",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Confirm password"),
      "new-password-123",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Change password" }),
    );

    await waitFor(() =>
      expect(mockPassword.mutateAsync).toHaveBeenCalledWith({
        confirmPassword: "new-password-123",
        currentPassword: "old-password",
        newPassword: "new-password-123",
      }),
    );
    expect(logout).toHaveBeenCalledTimes(1);
  });

  // BDD: ACCOUNT-002
  it("does not offer local password controls to a Google-only account", async () => {
    mockAccountData.authProvider = "google";
    const screen = await render(<AccountScreen {...accountProps()} />);

    expect(screen.getByText(/Google/)).toBeTruthy();
    expect(screen.queryByLabelText("Current password")).toBeNull();
    expect(screen.queryByRole("button", { name: "Change password" })).toBeNull();
  });

  it("shows explicit language choices and logout alongside the account disclosures", async () => {
    const screen = await render(
      <AccountScreen {...accountProps()} />,
    );

    expect(screen.getByText(/Email and password/)).toBeTruthy();
    expect(screen.getByText(/restore the account for 30 days/)).toBeTruthy();
    expect(screen.getByText(/up to about 60 days/)).toBeTruthy();
    expect(screen.getByText(/support@margins.cloud/)).toBeTruthy();
    expect(screen.getByText("Language · 언어")).toBeTruthy();
    expect(screen.getByRole("button", { name: "한국어" }).props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByRole("button", { name: "English" }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.queryByRole("button", { name: "Memory Cards" })).toBeNull();
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
  });

  // BDD: ACCOUNT-001
  it("switches the complete account surface language without losing a dirty profile draft", async () => {
    const props = accountProps();
    const screen = await render(<AccountScreen {...props} />);
    await fireEvent.changeText(
      screen.getByLabelText("Display name"),
      "Unsaved reader",
    );

    await fireEvent.press(screen.getByRole("button", { name: "한국어" }));
    expect(mockSetLocale).toHaveBeenCalledWith("ko");
    mockLocale = "ko";
    await screen.rerender(<AccountScreen {...props} />);

    expect(screen.getByText("계정")).toBeTruthy();
    expect(screen.getByText("프로필, 보안, 멤버십을 관리하세요.")).toBeTruthy();
    expect(screen.getByLabelText("표시 이름").props.value).toBe(
      "Unsaved reader",
    );
    expect(screen.getByRole("button", { name: "프로필과 언어 저장" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "한국어" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByText("개인정보와 지원")).toBeTruthy();
    expect(screen.getByText("회원 탈퇴")).toBeTruthy();
  });

  it("shows the membership tier from the authenticated session without guessing", async () => {
    const premium = await render(
      <AccountScreen {...accountProps({ membershipTier: "PREMIUM" })} />,
    );

    expect(premium.getByTestId("account-membership-tier")).toHaveTextContent("Premium");

    const unknown = await render(
      <AccountScreen {...accountProps()} />,
    );
    expect(unknown.queryByTestId("account-membership-tier")).toBeNull();
  });

  it("labels linked authentication without claiming local-only", async () => {
    mockAccountData.authProvider = "local+google";
    const linked = await render(
      <AccountScreen {...accountProps()} />,
    );
    expect(linked.getByText(/Email\/password and Google/)).toBeTruthy();
  });

  it("labels unknown authentication providers as unknown", async () => {
    mockAccountData.authProvider = "future-provider";
    const unknown = await render(
      <AccountScreen {...accountProps()} />,
    );
    expect(unknown.getByText(/Unknown/)).toBeTruthy();
  });

  // BDD: ACCOUNT-016, AUTH-025
  it("saves an explicitly selected locale with the profile and refreshes the same session", async () => {
    const refreshSession = jest.fn().mockResolvedValue(undefined);
    mockLocale = "ko";
    mockProfile.mutateAsync.mockImplementation(async () => {
      Object.assign(mockAccountData, {
        displayName: "Reader KO",
        preferredLocale: "ko",
      });
      return { account: { ...mockAccountData } };
    });
    const screen = await render(
      <AccountScreen {...accountProps({ refreshSession })} />,
    );

    expect(
      screen.getByRole("button", { name: "English" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole("button", { name: "한국어" }));
    await fireEvent.changeText(screen.getByLabelText("표시 이름"), "Reader KO");
    await fireEvent.press(screen.getByTestId("account-profile-save"));

    await waitFor(() => expect(mockProfile.mutateAsync).toHaveBeenCalledWith({
      displayName: "Reader KO",
      preferredLocale: "ko",
    }));
    expect(mockSetLocale).toHaveBeenCalledWith("ko");
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  // BDD: ACCOUNT-001, ACCOUNT-015
  it("does not overwrite the authoritative saved locale from a stale UI locale", async () => {
    mockLocale = "ko";
    const screen = await render(<AccountScreen {...accountProps()} />);

    await fireEvent.changeText(screen.getByLabelText("표시 이름"), "Reader KO");
    await fireEvent.press(screen.getByTestId("account-profile-save"));

    await waitFor(() =>
      expect(mockProfile.mutateAsync).toHaveBeenCalledWith({
        displayName: "Reader KO",
        preferredLocale: "en",
      }),
    );
  });

  // BDD: ACCOUNT-001
  // BDD: ACCOUNT-015
  it("resets the profile form from the authoritative save response without ending the session", async () => {
    const logout = jest.fn().mockResolvedValue(undefined);
    const refreshSession = jest.fn().mockResolvedValue(undefined);
    mockProfile.mutateAsync.mockImplementation(async () => {
      Object.assign(mockAccountData, {
        displayName: "Server-normalized reader",
        preferredLocale: "en",
      });
      return { account: { ...mockAccountData } };
    });
    const screen = await render(
      <AccountScreen {...accountProps({ logout, refreshSession })} />,
    );

    expect(screen.getByText("reader@example.com")).toBeTruthy();
    expect(screen.getByText("@reader")).toBeTruthy();
    expect(screen.getByText(/Email and password/)).toBeTruthy();
    await fireEvent.changeText(
      screen.getByLabelText("Display name"),
      "  Local draft  ",
    );
    await fireEvent.press(screen.getByTestId("account-profile-save"));

    await waitFor(() =>
      expect(mockProfile.mutateAsync).toHaveBeenCalledWith({
        displayName: "Local draft",
        preferredLocale: "en",
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Display name").props.value).toBe(
        "Server-normalized reader",
      ),
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
  });

  // BDD: ACCOUNT-016
  it("does not report a saved profile as failed when only session locale refresh fails", async () => {
    mockProfile.mutateAsync.mockImplementation(async () => {
      Object.assign(mockAccountData, { preferredLocale: "en" });
      return { account: { ...mockAccountData } };
    });
    const screen = await render(
      <AccountScreen
        {...accountProps({
          refreshSession: jest.fn().mockRejectedValue(new Error("offline")),
        })}
      />,
    );

    await fireEvent.press(screen.getByTestId("account-profile-save"));
    expect(await screen.findByText(/Profile saved, but the session locale/)).toBeTruthy();
    expect(screen.queryByText("The request could not be completed.")).toBeNull();
  });

  // BDD: ACCOUNT-003, ACCOUNT-012
  // BDD: ACCOUNT-012
  it("keeps the complete withdrawal lifecycle available without main-service cards", async () => {
    const screen = await render(
      <AccountScreen {...accountProps()} />,
    );

    expect(screen.queryByText("Memory Cards")).toBeNull();
    expect(screen.getByText(/restore the account for 30 days/)).toBeTruthy();
    expect(screen.getByText(/anonymized account shell/)).toBeTruthy();
    expect(screen.getByTestId("account-resignation-challenge")).toBeTruthy();
  });

  // BDD: ACCOUNT-003
  it("requests a challenge, confirms the verified resignation, and ends the session", async () => {
    const logout = jest.fn().mockResolvedValue(undefined);
    const resignation = deferred<void>();
    mockResign.mutateAsync.mockReturnValue(resignation.promise);
    const props = accountProps({ logout });
    jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === "destructive")?.onPress?.();
    });
    const screen = await render(<AccountScreen {...props} />);

    await fireEvent.press(screen.getByTestId("account-resignation-challenge"));
    await waitFor(() => expect(mockChallenge.mutateAsync).toHaveBeenCalledTimes(1));

    mockChallenge.data = { challengeId: "challenge-1" };
    await screen.rerender(<AccountScreen {...props} />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Privacy concerns" }),
    );
    await fireEvent.changeText(screen.getByLabelText("6-digit code"), "123456");
    await fireEvent.press(screen.getByTestId("account-resign-submit"));

    await waitFor(() =>
      expect(mockResign.mutateAsync).toHaveBeenCalledWith({
        actionToken: "verified",
        reason: "PRIVACY_CONCERNS",
      }),
    );
    expect(mockVerifyResignation.mutateAsync).toHaveBeenCalledWith({
      challengeId: "challenge-1",
      code: "123456",
    });
    expect(
      screen.getByTestId("account-resign-submit").props.accessibilityState,
    ).toMatchObject({ busy: true, disabled: true });
    resignation.resolve(undefined);
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  // BDD: ACCOUNT-003, ACCOUNT-015
  it("reuses a verified action token when resignation itself is retried", async () => {
    mockChallenge.data = { challengeId: "challenge-1" };
    mockResign.mutateAsync
      .mockRejectedValueOnce(
        new ApiRequestError({ code: "COMMON_INTERNAL_ERROR", status: 500 }),
      )
      .mockResolvedValueOnce(undefined);
    const logout = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === "destructive")?.onPress?.();
    });
    const screen = await render(
      <AccountScreen {...accountProps({ logout })} />,
    );

    await fireEvent.changeText(screen.getByLabelText("6-digit code"), "123456");
    await fireEvent.press(screen.getByTestId("account-resign-submit"));
    await screen.findByText("The request could not be completed.");
    await fireEvent.press(screen.getByTestId("account-resign-submit"));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(mockVerifyResignation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mockResign.mutateAsync).toHaveBeenCalledTimes(2);
    expect(mockResign.mutateAsync).toHaveBeenLastCalledWith({
      actionToken: "verified",
      reason: "NOT_USING",
    });
  });

  // BDD: PRIVACY-010, ACCOUNT-001
  // BDD: ACCOUNT-001
  it("renders the complete account and withdrawal surface in Korean", async () => {
    mockLocale = "ko";
    const screen = await render(
      <AccountScreen {...accountProps()} />,
    );

    expect(screen.getByText("계정")).toBeTruthy();
    expect(screen.getByText("프로필")).toBeTruthy();
    expect(screen.getByText("회원 탈퇴")).toBeTruthy();
    expect(screen.getByText(/30일 동안 계정을 복구/)).toBeTruthy();
    expect(screen.queryByText("Resign membership")).toBeNull();
  });

  it("uses a retry label for account load failures", async () => {
    mockAccountQuery.data = undefined;
    mockAccountQuery.isError = true;
    const screen = await render(<AccountScreen {...accountProps()} />);

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(mockAccountQuery.refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });

  // BDD: TERM-021
  it("exposes legal documents and support destinations as account actions", async () => {
    const onContactSupport = jest.fn().mockResolvedValue(undefined);
    const onOpenPrivacy = jest.fn();
    const onOpenPrivacyHistory = jest.fn();
    const onOpenTerms = jest.fn();
    const onOpenTermsHistory = jest.fn();
    const screen = await render(
      <AccountScreen
        {...accountProps({
          onContactSupport,
          onOpenPrivacy,
          onOpenPrivacyHistory,
          onOpenTerms,
          onOpenTermsHistory,
        })}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Privacy policy" }));
    await fireEvent.press(screen.getByRole("button", { name: "Policy history" }));
    await fireEvent.press(screen.getByRole("button", { name: "Service Terms" }));
    await fireEvent.press(screen.getByRole("button", { name: "Service Terms history" }));
    await fireEvent.press(screen.getByRole("button", { name: "Contact support" }));

    expect(onOpenPrivacy).toHaveBeenCalledTimes(1);
    expect(onOpenPrivacyHistory).toHaveBeenCalledTimes(1);
    expect(onOpenTerms).toHaveBeenCalledTimes(1);
    expect(onOpenTermsHistory).toHaveBeenCalledTimes(1);
    expect(onContactSupport).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      new ApiRequestError({ code: "ACCOUNT_CHALLENGE_INVALID", status: 400 }),
      /code is invalid, expired, already used/i,
    ],
    [
      new ApiRequestError({ code: "COMMON_INTERNAL_ERROR", status: 500 }),
      "The request could not be completed.",
    ],
  ])("maps resignation failures without mislabeling service errors", async (error, message) => {
    mockChallenge.data = { challengeId: "challenge-1" };
    mockResign.mutateAsync.mockRejectedValue(error);
    jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.style === "destructive")?.onPress?.();
    });
    const screen = await render(<AccountScreen {...accountProps()} />);

    await fireEvent.changeText(screen.getByLabelText("6-digit code"), "123456");
    await fireEvent.press(screen.getByTestId("account-resign-submit"));

    await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
  });
});
