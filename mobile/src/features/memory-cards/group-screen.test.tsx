import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import { MemoryCardGroupScreen } from "./group-screen";
import { useCardMutations, useGroupMutations, useMemoryCardGroup } from "./queries";
import { parseMemoryCardUpload } from "./upload";

let mockLocale: "en" | "ko" = "en";

jest.mock("@/shared/i18n/i18n-provider", () => ({
  useI18n: () => ({ locale: mockLocale }),
}));
jest.mock("./queries", () => ({
  useCardMutations: jest.fn(),
  useGroupMutations: jest.fn(),
  useMemoryCardGroup: jest.fn(),
}));

const mockUseCardMutations = jest.mocked(useCardMutations);
const mockUseGroupMutations = jest.mocked(useGroupMutations);
const mockUseMemoryCardGroup = jest.mocked(useMemoryCardGroup);
const firstCard = {
  cardId: 9,
  groupId: 2,
  frontText: "margin",
  backText: "space",
  memorized: false,
  position: 0,
};

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    isError: false,
    isPending: false,
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  mockLocale = "en";
  jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  mockUseMemoryCardGroup.mockReturnValue({
    data: {
      groupId: 2,
      title: "Words",
      cardCount: 1,
      cards: [firstCard],
    },
    isError: false,
    isPending: false,
  } as unknown as ReturnType<typeof useMemoryCardGroup>);
  mockUseGroupMutations.mockReturnValue({
    create: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useGroupMutations>);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// BDD: PROJ-010
it("exposes duplicate policies only after duplicate front text is detected", async () => {
  mockUseCardMutations.mockReturnValue({
    bulk: mutation(),
    create: mutation(),
    memorize: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);

  const view = await render(
    <MemoryCardGroupScreen groupId={2} onBack={jest.fn()} premium />,
  );

  expect(view.getByLabelText("Mark as memorized").props.accessibilityState).toMatchObject({
    checked: false,
    selected: false,
  });
  expect(view.queryByRole("button", { name: "Replace duplicates" })).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "Validate JSON" }));
  expect(view.getByTestId("memory-card-duplicate-review")).toHaveTextContent(/1 duplicate front text was detected/);
  expect(view.getByRole("button", { name: "Replace duplicates" }).props.accessibilityState).toMatchObject({ selected: true });
  expect(view.getByRole("button", { name: "Ignore duplicates" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Remove duplicates" })).toBeTruthy();
});

// BDD: PROJ-009
it("shares an editable JSON template and requires duplicate review before default replacement import", async () => {
  const bulk = mutation({
    mutateAsync: jest.fn().mockResolvedValue({ groupId: 2, cards: [firstCard] }),
  });
  mockUseCardMutations.mockReturnValue({
    bulk,
    create: mutation(),
    memorize: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(<MemoryCardGroupScreen groupId={2} onBack={jest.fn()} premium />);

  await fireEvent.press(view.getByTestId("memory-card-template-share"));
  const template = jest.mocked(Share.share).mock.calls[0]?.[0];
  expect(template?.title).toBe("Memory Card JSON template");
  expect(parseMemoryCardUpload(template?.message ?? "")).toHaveLength(2);

  await fireEvent.changeText(
    view.getByTestId("memory-card-upload-text"),
    JSON.stringify({ cards: [{ frontText: " MARGIN ", backText: "new space" }] }),
  );
  await fireEvent.press(view.getByTestId("memory-card-upload-submit"));
  expect(bulk.mutateAsync).not.toHaveBeenCalled();
  expect(view.getByTestId("memory-card-duplicate-review")).toBeTruthy();
  await fireEvent.press(view.getByTestId("memory-card-upload-submit"));
  await waitFor(() => expect(bulk.mutateAsync).toHaveBeenCalledWith({
    cards: [expect.objectContaining({ backText: "new space", frontText: "MARGIN" })],
    duplicatePolicy: "replace",
  }));
});

it("distinguishes invalid JSON from a failed bulk-import request", async () => {
  const bulk = mutation({ mutateAsync: jest.fn().mockRejectedValue(new Error("network")) });
  mockUseCardMutations.mockReturnValue({
    bulk,
    create: mutation(),
    memorize: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(
    <MemoryCardGroupScreen groupId={2} onBack={jest.fn()} premium />,
  );

  await fireEvent.changeText(view.getByLabelText("JSON cards"), "not-json");
  await fireEvent.press(view.getByText("Import cards"));
  expect(view.getByText("JSON must be a JSON object.")).toBeTruthy();
  expect(bulk.mutateAsync).not.toHaveBeenCalled();

  await fireEvent.changeText(
    view.getByLabelText("JSON cards"),
    JSON.stringify({ cards: [{ frontText: "a", backText: "b" }] }),
  );
  await fireEvent.press(view.getByText("Import cards"));
  await waitFor(() =>
    expect(
      view.getByText("The bulk upload could not be saved. Try again."),
    ).toBeTruthy(),
  );
  expect(bulk.mutateAsync).toHaveBeenCalledTimes(1);
  expect(view.getByTestId("memory-card-upload-server-error")).toBeTruthy();
});

// BDD: FRONT-151, FRONT-156, MEM-007 - the draft stays editable, validation
// names the exact failing path, and invalid input never reaches the API.
// BDD: MEM-007
it("keeps invalid JSON visible and names the failing card path", async () => {
  const bulk = mutation();
  mockUseCardMutations.mockReturnValue({
    bulk,
    create: mutation(),
    memorize: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(
    <MemoryCardGroupScreen groupId={2} onBack={jest.fn()} premium />,
  );
  const draft = JSON.stringify({
    cards: [{ frontText: "word", backText: 3 }],
  });

  await fireEvent.changeText(view.getByTestId("memory-card-upload-text"), draft);
  await fireEvent.press(view.getByText("Validate JSON"));

  expect(view.getByTestId("memory-card-upload-validation-error")).toBeTruthy();
  expect(view.getByRole("alert")).toBeTruthy();
  expect(view.getByText("cards[0].backText must be text.")).toBeTruthy();
  expect(view.getByTestId("memory-card-upload-text").props.value).toBe(draft);
  expect(bulk.mutateAsync).not.toHaveBeenCalled();
});

// BDD: MEM-007
it("localizes invalid JSON through the shared semantic alert", async () => {
  mockLocale = "ko";
  const bulk = mutation();
  mockUseCardMutations.mockReturnValue({
    bulk,
    create: mutation(),
    memorize: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(
    <MemoryCardGroupScreen groupId={2} onBack={jest.fn()} premium />,
  );

  await fireEvent.changeText(view.getByTestId("memory-card-upload-text"), "not-json");
  await fireEvent.press(view.getByRole("button", { name: "JSON 검증" }));

  expect(view.getByTestId("memory-card-upload-validation-error")).toBeTruthy();
  expect(view.getByRole("alert")).toBeTruthy();
  expect(view.getByText("JSON은(는) JSON 객체여야 합니다.")).toBeTruthy();
  expect(bulk.mutateAsync).not.toHaveBeenCalled();
});

// BDD: FRONT-152, FRONT-153 - the editor starts from editable card fields and
// BDD: FRONT-153
// an untouched generated snapshot follows a successful adjacent card create.
it("initializes and synchronizes generated JSON after a card mutation", async () => {
  const nextCard = {
    cardId: 10,
    groupId: 2,
    frontText: "paper",
    backText: "종이",
    memorized: false,
    position: 1,
  };
  const create = mutation({
    mutateAsync: jest.fn().mockResolvedValue({
      groupId: 2,
      cards: [firstCard, nextCard],
    }),
  });
  mockUseCardMutations.mockReturnValue({
    bulk: mutation(),
    create,
    memorize: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(
    <MemoryCardGroupScreen groupId={2} onBack={jest.fn()} premium />,
  );

  const initial = JSON.parse(view.getByTestId("memory-card-upload-text").props.value);
  expect(initial.cards).toEqual([
    {
      frontText: "margin",
      backText: "space",
      exampleText: "",
      memo: "",
    },
  ]);
  await fireEvent.changeText(view.getByLabelText("Front"), "paper");
  await fireEvent.changeText(view.getByLabelText("Back"), "종이");
  await fireEvent.press(view.getAllByText("Save")[1]);

  await waitFor(() => expect(create.mutateAsync).toHaveBeenCalled());
  await waitFor(() => {
    const generated = JSON.parse(
      view.getByTestId("memory-card-upload-text").props.value,
    );
    expect(generated.cards).toHaveLength(2);
    expect(generated.cards[1].frontText).toBe("paper");
  });
});

// BDD: FRONT-154 - a user-owned draft is not overwritten by adjacent CRUD.
it("preserves a dirty JSON draft after a card mutation", async () => {
  const create = mutation({
    mutateAsync: jest.fn().mockResolvedValue({
      groupId: 2,
      cards: [firstCard],
    }),
  });
  mockUseCardMutations.mockReturnValue({
    bulk: mutation(),
    create,
    memorize: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(
    <MemoryCardGroupScreen groupId={2} onBack={jest.fn()} premium />,
  );
  const draft = JSON.stringify({
    cards: [{ frontText: "draft", backText: "초안" }],
  });
  await fireEvent.changeText(view.getByTestId("memory-card-upload-text"), draft);
  await fireEvent.changeText(view.getByLabelText("Front"), "paper");
  await fireEvent.changeText(view.getByLabelText("Back"), "종이");
  await fireEvent.press(view.getAllByText("Save")[1]);

  await waitFor(() => expect(create.mutateAsync).toHaveBeenCalled());
  expect(view.getByTestId("memory-card-upload-text").props.value).toBe(draft);
});

// BDD: FRONT-146, FRONT-159, MEM-002 - a direct study route starts on the
// first hidden front and exposes the persistent memorized command/count.
it("restores direct study mode with memorized progress and toggle", async () => {
  const memorize = mutation();
  mockUseCardMutations.mockReturnValue({
    bulk: mutation(),
    create: mutation(),
    memorize,
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(
    <MemoryCardGroupScreen
      groupId={2}
      mode="study"
      onBack={jest.fn()}
      premium
    />,
  );

  expect(view.getByTestId("memory-card-study-screen")).toBeTruthy();
  expect(view.getByText("margin")).toBeTruthy();
  expect(view.queryByText("space")).toBeNull();
  expect(view.getByText("The answer is hidden.")).toBeTruthy();
  expect(view.getByTestId("memory-card-study-memorized-count")).toHaveTextContent(
    "0/1 memorized",
  );
  await fireEvent.press(view.getByTestId("memory-card-study-memorized-toggle"));
  expect(memorize.mutate).toHaveBeenCalledWith({ cardId: 9, memorized: true });
});

// BDD: MEM-002 - an empty direct Study route returns to its owning group,
// not to the global Library destination.
it("labels the empty Study exit as a return to the group", async () => {
  mockUseMemoryCardGroup.mockReturnValue({
    data: {
      groupId: 2,
      title: "Words",
      cardCount: 0,
      cards: [],
    },
    isError: false,
    isPending: false,
  } as unknown as ReturnType<typeof useMemoryCardGroup>);
  mockUseCardMutations.mockReturnValue({
    bulk: mutation(),
    create: mutation(),
    memorize: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const onBack = jest.fn();
  const view = await render(
    <MemoryCardGroupScreen
      groupId={2}
      mode="study"
      onBack={onBack}
      premium
    />,
  );

  expect(view.queryByRole("button", { name: "Back to Library" })).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "Back to group" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

// BDD: PROJ-013
it("keeps long study meanings vertically scrollable above thumb-reachable controls", async () => {
  mockUseMemoryCardGroup.mockReturnValue({
    data: {
      groupId: 2,
      title: "Words",
      cardCount: 1,
      cards: [{ ...firstCard, backText: "Long meaning ".repeat(120) }],
    },
    isError: false,
    isPending: false,
  } as ReturnType<typeof useMemoryCardGroup>);
  mockUseCardMutations.mockReturnValue({
    bulk: mutation(), create: mutation(), memorize: mutation(), remove: mutation(), update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(<MemoryCardGroupScreen groupId={2} mode="study" onBack={jest.fn()} premium />);

  await fireEvent.press(view.getByRole("button", { name: "Reveal answer" }));
  expect(view.getByTestId("memory-card-study-card-scroll")).toHaveProp("contentContainerStyle", expect.objectContaining({ flexGrow: 1, minWidth: 0 }));
  expect(view.getByTestId("memory-card-study-actions")).toHaveStyle({ marginTop: "auto" });
  expect(view.getByRole("button", { name: "Next card" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Mark as memorized" })).toBeTruthy();
});

// BDD: FRONT-160, MEM-003 - Query supplies the rolled-back authoritative
// value and the study UI announces the failed save.
// BDD: MEM-003
it("shows the memorized save error beside the rolled-back study state", async () => {
  mockUseCardMutations.mockReturnValue({
    bulk: mutation(),
    create: mutation(),
    memorize: mutation({ isError: true }),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(
    <MemoryCardGroupScreen
      groupId={2}
      mode="study"
      onBack={jest.fn()}
      premium
    />,
  );

  expect(view.getByTestId("memory-card-study-memorized-error")).toHaveTextContent(
    "The memorized state could not be saved.",
  );
  expect(
    view.getByTestId("memory-card-study-memorized-toggle").props.accessibilityState,
  ).toMatchObject({ checked: false, selected: false });
  expect(view.getByTestId("memory-card-study-memorized-count")).toHaveTextContent(
    "0/1 memorized",
  );
});

// BDD: FRONT-155 - large groups receive a valid generated payload capped at
// the backend's one-upload boundary plus a visible total/limit notice.
it("caps generated JSON and explains the large-group boundary", async () => {
  const cards = Array.from({ length: 501 }, (_, index) => ({
    cardId: index + 1,
    groupId: 2,
    frontText: `word-${index + 1}`,
    backText: `meaning-${index + 1}`,
    memorized: false,
    position: index,
  }));
  mockUseMemoryCardGroup.mockReturnValue({
    data: { groupId: 2, title: "Words", cardCount: cards.length, cards },
    isError: false,
    isPending: false,
  } as ReturnType<typeof useMemoryCardGroup>);
  mockUseCardMutations.mockReturnValue({
    bulk: mutation(),
    create: mutation(),
    memorize: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(
    <MemoryCardGroupScreen groupId={2} onBack={jest.fn()} premium />,
  );

  expect(view.getByTestId("memory-card-upload-limit-notice")).toHaveTextContent(
    "This group has 501 cards. Generated JSON includes the first 500, the one-upload limit.",
  );
  expect(
    JSON.parse(view.getByTestId("memory-card-upload-text").props.value).cards,
  ).toHaveLength(500);
});

// BDD: FRONT-157, MEM-007 - exported JSON uses the same canonical envelope as
// import, so a shared backup can be validated and restored without rewriting.
it("exports a canonical JSON payload that round-trips through import", async () => {
  mockUseCardMutations.mockReturnValue({
    bulk: mutation(),
    create: mutation(),
    memorize: mutation(),
    remove: mutation(),
    update: mutation(),
  } as unknown as ReturnType<typeof useCardMutations>);
  const view = await render(
    <MemoryCardGroupScreen groupId={2} onBack={jest.fn()} premium />,
  );

  await fireEvent.press(view.getByRole("button", { name: "Export JSON" }));

  expect(Share.share).toHaveBeenCalledTimes(1);
  const shared = jest.mocked(Share.share).mock.calls[0]?.[0];
  expect(shared?.title).toBe("Words");
  expect(parseMemoryCardUpload(shared?.message ?? "")).toEqual([
    {
      backText: "space",
      exampleText: undefined,
      frontText: "margin",
      memo: undefined,
    },
  ]);
});
