import { fireEvent, render } from "@testing-library/react-native";

import { TermsHistoryScreen, TermsScreen } from "./terms-screen";

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: "en" }),
}));

// BDD: TERM-021
it("shows the unpublished status without an acceptance control", async () => {
  const onOpenHistory = jest.fn();
  const screen = await render(
    <TermsScreen
      onContact={jest.fn()}
      onOpenHistory={onOpenHistory}
      onOpenPrivacy={jest.fn()}
    />,
  );

  expect(screen.getByText("No version is published yet")).toBeTruthy();
  expect(screen.getByText(/No Service Terms acceptance is currently requested/)).toBeTruthy();
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  fireEvent.press(screen.getByText("Service Terms history"));
  expect(onOpenHistory).toHaveBeenCalledTimes(1);
});

// BDD: TERM-021
it("shows an empty publication history without a fabricated version", async () => {
  const screen = await render(
    <TermsHistoryScreen
      onContact={jest.fn()}
      onOpenCurrent={jest.fn()}
      onOpenPrivacy={jest.fn()}
    />,
  );

  expect(screen.getByText("There are no published versions.")).toBeTruthy();
  expect(screen.queryByText(/effective date/i)).toBeNull();
});
