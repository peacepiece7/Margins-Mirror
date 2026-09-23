import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { ApiRequestError } from "@/shared/api/error";
import { RecoveryScreen, type RecoveryMutations } from "./recovery-screen";

const mockChallenge: RecoveryMutations["challenge"] = {
  data: undefined,
  isPending: false,
  mutateAsync: jest.fn(),
  reset: jest.fn(),
};
const mockVerify: RecoveryMutations["verify"] = {
  data: undefined,
  isPending: false,
  mutateAsync: jest.fn(),
  reset: jest.fn(),
};
const mockRecover: RecoveryMutations["recover"] = {
  data: undefined,
  isPending: false,
  mutateAsync: jest.fn(),
  reset: jest.fn(),
};
const mutations: RecoveryMutations = {
  challenge: mockChallenge,
  recover: mockRecover,
  verify: mockVerify,
};

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en", t: (key: string) => key }),
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockChallenge.data = undefined;
  mockChallenge.isPending = false;
  mockVerify.data = undefined;
  mockVerify.isPending = false;
  mockRecover.data = undefined;
  mockRecover.isPending = false;
});

// BDD: ACCOUNT-015
it("shows an accessible required error instead of silently ignoring an empty email", async () => {
  const view = await render(
    <RecoveryScreen mutations={mutations} onBack={jest.fn()} />,
  );

  await fireEvent.press(view.getByRole("button", { name: "Recover account" }));

  const error = await view.findByText("This field is required.");
  expect(error.props.accessibilityLiveRegion).toBe("polite");
  expect(view.getByLabelText("Email").props["aria-describedby"]).toBe(
    "Email-error",
  );
  expect(mockChallenge.mutateAsync).not.toHaveBeenCalled();
});

// BDD: ACCOUNT-005, ACCOUNT-015
it("submits a single recovery action while the one-time token is in flight", async () => {
  jest.mocked(mockChallenge.mutateAsync).mockImplementation(async () => {
    const result = {
      challengeId: "challenge",
      devVerificationCode: "123456",
    };
    mockChallenge.data = result;
    return result;
  });
  jest.mocked(mockVerify.mutateAsync).mockImplementation(async () => {
    const result = { actionToken: "single-use" };
    mockVerify.data = result;
    return result;
  });
  const recovery = deferred<void>();
  jest.mocked(mockRecover.mutateAsync).mockImplementation(async () => {
    mockRecover.isPending = true;
    await recovery.promise;
    mockRecover.isPending = false;
  });
  const view = await render(
    <RecoveryScreen mutations={mutations} onBack={jest.fn()} />,
  );

  await fireEvent.changeText(view.getByLabelText("Email"), "reader@example.com");
  await fireEvent.press(view.getByRole("button", { name: "Recover account" }));
  await waitFor(() => expect(view.getByLabelText("Verification code")).toBeTruthy());

  await fireEvent.changeText(view.getByLabelText("Verification code"), "123456");
  await fireEvent.press(view.getByRole("button", { name: "Confirm code" }));
  await waitFor(() => expect(view.getByText("Recovery action")).toBeTruthy());

  const restore = view.getByRole("button", { name: "Restore account" });
  await fireEvent.press(restore);
  await fireEvent.press(restore);

  expect(mockRecover.mutateAsync).toHaveBeenCalledTimes(1);
  expect(mockRecover.mutateAsync).toHaveBeenCalledWith({
    action: "RESTORE",
    actionToken: "single-use",
    email: "reader@example.com",
  });
  await waitFor(() =>
    expect(
      view.getByRole("button", { name: "Erase all account activity" }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true }),
  );

  recovery.resolve();
  await waitFor(() =>
    expect(
      view.getByText(
        "Your account was restored. Sign in with your original method to continue.",
      ),
    ).toBeTruthy(),
  );
});

it("does not render a development verification code in production", async () => {
  const originalDev = __DEV__;
  Object.defineProperty(globalThis, "__DEV__", {
    configurable: true,
    value: false,
  });
  jest.mocked(mockChallenge.mutateAsync).mockImplementation(async () => {
    const result = {
      challengeId: "challenge",
      devVerificationCode: "123456",
    };
    mockChallenge.data = result;
    return result;
  });
  try {
    const view = await render(
      <RecoveryScreen mutations={mutations} onBack={jest.fn()} />,
    );
    await fireEvent.changeText(
      view.getByLabelText("Email"),
      "reader@example.com",
    );
    await fireEvent.press(
      view.getByRole("button", { name: "Recover account" }),
    );

    await waitFor(() =>
      expect(
        view.getByText(
          "If the address matches an account, a code has been sent.",
        ),
      ).toBeTruthy(),
    );
    expect(view.queryByText("DEV: 123456")).toBeNull();
  } finally {
    Object.defineProperty(globalThis, "__DEV__", {
      configurable: true,
      value: originalDev,
    });
  }
});

// BDD: ACCOUNT-004, ACCOUNT-005
it("explains an invalid recovery code and can request a fresh challenge", async () => {
  jest.mocked(mockChallenge.mutateAsync).mockImplementation(async () => {
    const result = { challengeId: `challenge-${jest.mocked(mockChallenge.mutateAsync).mock.calls.length}` };
    mockChallenge.data = result;
    return result;
  });
  jest.mocked(mockVerify.mutateAsync).mockRejectedValue(
    new ApiRequestError({ code: "ACCOUNT_CHALLENGE_INVALID", status: 400 }),
  );
  const view = await render(
    <RecoveryScreen mutations={mutations} onBack={jest.fn()} />,
  );

  await fireEvent.changeText(view.getByLabelText("Email"), "reader@example.com");
  await fireEvent.press(view.getByRole("button", { name: "Recover account" }));
  await fireEvent.changeText(
    await view.findByLabelText("Verification code"),
    "123456",
  );
  await fireEvent.press(view.getByRole("button", { name: "Confirm code" }));
  expect(await view.findByText(/invalid or expired/)).toBeTruthy();

  await fireEvent.changeText(view.getByLabelText("Verification code"), "123");
  await fireEvent.press(view.getByRole("button", { name: "Resend code" }));

  await waitFor(() => expect(mockChallenge.mutateAsync).toHaveBeenCalledTimes(2));
  expect(mockVerify.reset).toHaveBeenCalledTimes(2);
  expect(view.getByLabelText("Verification code").props.value).toBe("");
});

it("blocks verification while a replacement challenge is pending", async () => {
  const replacement = deferred<{ challengeId: string }>();
  jest.mocked(mockChallenge.mutateAsync)
    .mockImplementationOnce(async () => {
      const result = { challengeId: "challenge-1" };
      mockChallenge.data = result;
      return result;
    })
    .mockImplementationOnce(async () => {
      mockChallenge.isPending = true;
      const result = await replacement.promise;
      mockChallenge.data = result;
      mockChallenge.isPending = false;
      return result;
    });
  const view = await render(
    <RecoveryScreen mutations={mutations} onBack={jest.fn()} />,
  );

  await fireEvent.changeText(view.getByLabelText("Email"), "reader@example.com");
  await fireEvent.press(view.getByRole("button", { name: "Recover account" }));
  await fireEvent.changeText(
    await view.findByLabelText("Verification code"),
    "123456",
  );
  await fireEvent.press(view.getByRole("button", { name: "Resend code" }));
  view.rerender(<RecoveryScreen mutations={mutations} onBack={jest.fn()} />);

  const confirm = view.getByRole("button", { name: "Confirm code" });
  expect(confirm.props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(confirm);
  expect(mockVerify.mutateAsync).not.toHaveBeenCalled();

  await act(async () => {
    replacement.resolve({ challengeId: "challenge-2" });
    await replacement.promise;
  });
  await waitFor(() => expect(mockChallenge.mutateAsync).toHaveBeenCalledTimes(2));
});

// BDD: ACCOUNT-005, ACCOUNT-015
it("returns an expired erase token to a fresh challenge and resets confirmation", async () => {
  jest.mocked(mockChallenge.mutateAsync).mockImplementation(async () => {
    const result = {
      challengeId: `challenge-${jest.mocked(mockChallenge.mutateAsync).mock.calls.length}`,
    };
    mockChallenge.data = result;
    return result;
  });
  jest.mocked(mockVerify.mutateAsync).mockImplementation(async () => {
    const result = {
      actionToken: `token-${jest.mocked(mockVerify.mutateAsync).mock.calls.length}`,
    };
    mockVerify.data = result;
    return result;
  });
  jest.mocked(mockRecover.mutateAsync).mockRejectedValueOnce(
    new ApiRequestError({ code: "ACCOUNT_CHALLENGE_INVALID", status: 400 }),
  );
  const view = await render(
    <RecoveryScreen mutations={mutations} onBack={jest.fn()} />,
  );

  await fireEvent.changeText(view.getByLabelText("Email"), "reader@example.com");
  await fireEvent.press(view.getByRole("button", { name: "Recover account" }));
  await fireEvent.changeText(
    await view.findByLabelText("Verification code"),
    "123456",
  );
  await fireEvent.press(view.getByRole("button", { name: "Confirm code" }));
  await fireEvent.press(await view.findByTestId("account-recovery-erase"));
  await fireEvent.press(view.getByTestId("account-recovery-erase-confirm"));

  expect(await view.findByText(/invalid or expired/)).toBeTruthy();
  expect(view.getByLabelText("Email").props.editable).toBe(true);
  expect(view.getByRole("button", { name: "Recover account" })).toBeTruthy();
  expect(view.queryByText("Recovery action")).toBeNull();
  expect(mockVerify.reset).toHaveBeenCalledTimes(2);
  expect(mockRecover.reset).toHaveBeenCalledTimes(2);

  await fireEvent.press(view.getByRole("button", { name: "Recover account" }));
  await fireEvent.changeText(
    await view.findByLabelText("Verification code"),
    "123456",
  );
  await fireEvent.press(view.getByRole("button", { name: "Confirm code" }));

  await waitFor(() => expect(mockChallenge.mutateAsync).toHaveBeenCalledTimes(2));
  expect(await view.findByTestId("account-recovery-erase")).toBeTruthy();
  expect(view.queryByTestId("account-recovery-erase-confirm")).toBeNull();
});

// BDD: ACCOUNT-004
it("shows the same neutral response for nonexistent or ACTIVE account challenge envelopes", async () => {
  jest.mocked(mockChallenge.mutateAsync)
    .mockImplementationOnce(async () => {
      const result = {
      challengeId: "neutral-nonexistent",
      };
      mockChallenge.data = result;
      return result;
    })
    .mockImplementationOnce(async () => {
      const result = {
      challengeId: "neutral-active",
      };
      mockChallenge.data = result;
      return result;
    });

  for (const email of ["missing@example.com", "active@example.com"]) {
    const view = await render(
      <RecoveryScreen mutations={mutations} onBack={jest.fn()} />,
    );
    await fireEvent.changeText(view.getByLabelText("Email"), email);
    await fireEvent.press(view.getByRole("button", { name: "Recover account" }));
    expect(await view.findByText(
      "If the address matches an account, a code has been sent.",
    )).toBeTruthy();
    await act(async () => view.unmount());
  }
});

// BDD: ACCOUNT-005, ACCOUNT-007, PRIVACY-006
it("requires an explicit second action before irreversible activity erasure", async () => {
  jest.mocked(mockChallenge.mutateAsync).mockImplementation(async () => {
    const result = {
      challengeId: "challenge",
      devVerificationCode: "123456",
    };
    mockChallenge.data = result;
    return result;
  });
  jest.mocked(mockVerify.mutateAsync).mockImplementation(async () => {
    const result = { actionToken: "single-use" };
    mockVerify.data = result;
    return result;
  });
  jest.mocked(mockRecover.mutateAsync).mockResolvedValue(undefined);
  const view = await render(
    <RecoveryScreen mutations={mutations} onBack={jest.fn()} />,
  );
  await fireEvent.changeText(await view.findByLabelText("Email"), "resigned@example.com");
  await fireEvent.press(view.getByRole("button", { name: "Recover account" }));
  await fireEvent.changeText(await view.findByLabelText("Verification code"), "123456");
  await fireEvent.press(view.getByRole("button", { name: "Confirm code" }));
  await view.findByText("Recovery action");

  await fireEvent.press(view.getByTestId("account-recovery-erase"));
  expect(mockRecover.mutateAsync).not.toHaveBeenCalled();
  expect(view.getByText(/irreversible after the purge runs/)).toBeTruthy();
  await fireEvent.press(view.getByTestId("account-recovery-erase-confirm"));

  await waitFor(() =>
    expect(mockRecover.mutateAsync).toHaveBeenCalledWith({
      action: "ERASE_ALL_ACTIVITY",
      actionToken: "single-use",
      email: "resigned@example.com",
    }),
  );
  expect(
    await view.findByText(
      "Activity erasure is scheduled for the account purge date. The account remains resigned; restore it within the 30-day window to sign in again.",
    ),
  ).toBeTruthy();
  expect(
    view.queryByText(
      "Your account was restored. Sign in with your original method to continue.",
    ),
  ).toBeNull();
});
