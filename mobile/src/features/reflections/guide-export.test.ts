import { safeMarkdownFilename, shareGuideMarkdown } from "./guide-export";

describe("guide Markdown export", () => {
  // BDD: RLOOP-033 (native file/share adapter; server projection guarantees remain upstream)
  it("writes and shares the exact deterministic server content", async () => {
    const adapter = {
      share: jest.fn().mockResolvedValue(undefined),
      write: jest.fn().mockResolvedValue("file:///cache/guide.md"),
    };
    const result = await shareGuideMarkdown(
      {
        content: "# Guide\n\n- Exact content",
        filename: "../My Book v3 participant.md",
        guideId: 3,
        guideVersion: 3,
        projection: "PARTICIPANT",
      },
      adapter,
    );

    expect(adapter.write).toHaveBeenCalledWith(
      "My-Book-v3-participant.md",
      "# Guide\n\n- Exact content",
    );
    expect(adapter.share).toHaveBeenCalledWith("file:///cache/guide.md");
    expect(result).toEqual({
      filename: "My-Book-v3-participant.md",
      uri: "file:///cache/guide.md",
    });
  });

  it("keeps only a local Markdown basename", () => {
    expect(safeMarkdownFilename("folder/guide")).toBe("guide.md");
  });
});
