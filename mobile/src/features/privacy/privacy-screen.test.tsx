import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";

import { PrivacyHistoryScreen, PrivacyScreen } from "./privacy-screen";

const mockRequirements = jest.fn();
let mockLocale: "en" | "ko" = "en";

jest.mock("@/shared/api/api-client-provider", () => ({
  useApiClient: () => ({}),
}));
jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: mockLocale }),
}));
jest.mock("./api", () => ({
  createPrivacyApi: () => ({ requirements: mockRequirements }),
}));

function withQueryClient(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

describe("native privacy documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocale = "en";
  });

  it("keeps the complete policy readable when requirements metadata is unavailable", async () => {
    mockRequirements.mockRejectedValue(new Error("offline"));
    const screen = await withQueryClient(
      <PrivacyScreen onOpenHistory={jest.fn()} />,
    );

    expect(screen.getByText("1. Operator and contact")).toBeTruthy();
    expect(screen.getByText("6. Safeguards and rights")).toBeTruthy();
    expect(await screen.findByText("Privacy information could not be loaded.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Policy history" })).toBeTruthy();
  });

  it("renders native history with a route back to the current document", async () => {
    const onOpenCurrent = jest.fn();
    const screen = await render(
      <PrivacyHistoryScreen onOpenCurrent={onOpenCurrent} />,
    );

    expect(screen.getByText("Privacy Policy History")).toBeTruthy();
    expect(screen.getByText("Effective 2026-07-27 · Initial publication")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Full policy dated 2026-07-27" })).toBeTruthy();
  });

  it("does not label bundled text as a newer live policy version", async () => {
    mockRequirements.mockResolvedValue({
      aiTransferVersion: "2026-09-01",
      effectiveDate: "2026-09-01",
      minimumAge: 16,
      privacyPolicyVersion: "2026-09-01",
    });
    const screen = await withQueryClient(
      <PrivacyScreen onOpenHistory={jest.fn()} />,
    );

    expect(
      await screen.findByText(
        "This build contains an older policy. Update Margins to review and accept the current version.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("2026-09-01")).toBeNull();
    expect(screen.getAllByText(/2026-07-27/).length).toBeGreaterThan(0);
  });

  // BDD: PRIVACY-010
  it("renders the current policy and history wholly from the Korean catalog", async () => {
    mockLocale = "ko";
    mockRequirements.mockResolvedValue({
      aiTransferVersion: "2026-07-27",
      effectiveDate: "2026-07-27",
      minimumAge: 14,
      privacyPolicyVersion: "2026-07-27",
    });
    const policy = await withQueryClient(
      <PrivacyScreen onOpenHistory={jest.fn()} />,
    );
    expect(policy.getAllByText("개인정보").length).toBeGreaterThan(0);
    expect(policy.getByText("1. 운영자와 문의")).toBeTruthy();
    expect(policy.getByText("6. 안전조치와 권리")).toBeTruthy();
    expect(policy.queryByText("1. Operator and contact")).toBeNull();

    const history = await render(
      <PrivacyHistoryScreen onOpenCurrent={jest.fn()} />,
    );
    expect(history.getByText("개인정보처리방침 변경 이력")).toBeTruthy();
    expect(history.getByText("시행일 2026-07-27 · 최초 공개")).toBeTruthy();
  });
});
