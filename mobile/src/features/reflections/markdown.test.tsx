import { render } from "@testing-library/react-native";

import { ReflectionMarkdown } from "./markdown";

it("renders headings, emphasis, lists, quotes, code, links, and author line breaks", async () => {
  const screen = await render(
    <ReflectionMarkdown
      content={"# Heading\n**bold** and *italic*\n- item\n> quote\n`code` and [source](https://example.com)\n\nparagraph"}
    />,
  );

  expect(screen.getByText("Heading")).toBeTruthy();
  expect(screen.getByText("bold")).toHaveStyle({ fontWeight: "700" });
  expect(screen.getByText("italic")).toHaveStyle({ fontStyle: "italic" });
  expect(screen.getByText("item")).toBeTruthy();
  expect(screen.getByText("quote")).toBeTruthy();
  expect(screen.getByText("code")).toHaveStyle({ fontFamily: "monospace" });
  expect(screen.getByRole("link", { name: "source" })).toBeTruthy();
  expect(screen.getByText("paragraph")).toBeTruthy();
});
