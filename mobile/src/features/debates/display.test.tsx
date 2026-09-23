import { render } from "@testing-library/react-native";

import { localizedPersonaDisplay, SafeDebateMessage, SpeakerGlyph } from "./display";

describe("debate display", () => {
  // BDD: FRONT-041
  it("localizes seeded personas while preserving reader-created names", () => {
    const seeded = { displayName: "Journalist", name: "journalist", personaId: 1, tone: "stored" };
    expect(localizedPersonaDisplay(seeded, "ko")).toEqual({ displayName: "기자", tone: "맥락과 의도" });
    expect(localizedPersonaDisplay({ displayName: "My Lens", name: "reader-my-lens-1234", personaId: 2, tone: "Gentle" }, "ko"))
      .toEqual({ displayName: "My Lens", tone: "Gentle" });
  });

  // BDD: FRONT-165
  it("uses a non-text speaker glyph instead of letters, punctuation, symbols, or counts", async () => {
    const view = await render(<SpeakerGlyph />);
    expect(view.getByTestId("speaker-glyph", { includeHiddenElements: true })).toHaveProp("accessibilityElementsHidden", true);
    expect(view.toJSON()).toMatchObject({ children: [{ children: [] }, { children: [] }] });
  });

  // BDD: FRONT-042, FRONT-125
  it("renders emphasis, line breaks, repeated spaces, and structured response labels as native text", async () => {
    const view = await render(<SafeDebateMessage content={"**Claim**: Power  shifts\nSupport: The text\n\nNext question: Why?"} />);
    expect(view.getByTestId("debate-structured-response")).toBeTruthy();
    const rendered = JSON.stringify(view.toJSON());
    expect(rendered).toContain("Claim");
    expect(rendered).toContain("Power  shifts");
    expect(rendered).toContain("Next question");
  });

  // BDD: FRONT-125
  it("renders structured response metadata while retaining the full persisted message", async () => {
    const view = await render(
      <SafeDebateMessage
        content="The complete persisted transcript remains authoritative."
        structure={{
          alternativeLens: "Read the silence as agency.",
          claim: "The choice changes the group.",
          nextQuestion: "Who benefits?",
          support: "The final scene reverses the opening image.",
        }}
      />,
    );
    expect(view.getByText(/Claim: The choice changes the group/)).toBeTruthy();
    expect(view.getByText(/Support: The final scene reverses/)).toBeTruthy();
    expect(view.getByText(/Alternative lens: Read the silence/)).toBeTruthy();
    expect(view.getByText(/Next question: Who benefits/)).toBeTruthy();
    expect(view.getByTestId("debate-full-persisted-message")).toHaveTextContent("The complete persisted transcript remains authoritative.");
  });
});
