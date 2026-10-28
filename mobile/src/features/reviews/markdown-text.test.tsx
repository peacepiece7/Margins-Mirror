import { fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";

import { MarkdownText } from "./markdown-text";

// BDD: FRONT-034
it("preserves line and paragraph breaks while rendering safe native Markdown blocks and links", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  const view = await render(
    <MarkdownText content={"First line\n**Second line**\n\n- List item\n> Quote\n`inline`\n```\ncode()\n```\n[Source](https://example.test/source)"} />,
  );

  expect(view.getByText("First line")).toBeTruthy();
  expect(view.getByText("Second line")).toHaveStyle({ fontWeight: "700" });
  expect(view.getByText("• List item")).toBeTruthy();
  expect(view.getByText("Quote")).toHaveStyle({ borderLeftWidth: 2 });
  expect(view.getByText("code()")).toHaveStyle({ fontFamily: "monospace" });
  await fireEvent.press(view.getByRole("link", { name: "Source" }));
  expect(open).toHaveBeenCalledWith("https://example.test/source");
  expect(view.getByTestId("markdown-paragraph-break")).toHaveStyle({ height: 8 });
});

// BDD: FRONT-034
it("converts legacy CKEditor HTML to safe native text without exposing tags or executable content", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  const view = await render(
    <MarkdownText
      content={'<p onclick="bad()">Safe<br><strong>bold</strong><script>bad()</script><a href="javascript:bad()">unsafe link</a> &amp; <a href="https://example.test/source">Source</a></p><ul><li>One</li></ul>'}
    />,
  );

  expect(view.getByText("Safe")).toBeTruthy();
  expect(view.getByText("bold")).toHaveStyle({ fontWeight: "700" });
  expect(view.getByText(/unsafe link/)).toBeTruthy();
  expect(view.queryByText(/bad\(\)/)).toBeNull();
  expect(view.queryByText(/<p/)).toBeNull();
  expect(view.getByText("• One")).toBeTruthy();
  await fireEvent.press(view.getByRole("link", { name: "Source" }));
  expect(open).toHaveBeenCalledWith("https://example.test/source");
});

// BDD: FRONT-034
it("normalizes generic legacy elements including div, span, b, br, script, and style", async () => {
  const view = await render(
    <MarkdownText
      content={'<div><span>Plain</span><br><b>bold</b></div><style>.bad{}</style><script>bad()</script>'}
    />,
  );

  expect(view.getByText("Plain")).toBeTruthy();
  expect(view.getByText("bold")).toHaveStyle({ fontWeight: "700" });
  expect(view.queryByText(/<div|<span|<br|<b|<style|<script/)).toBeNull();
  expect(view.queryByText(/bad\(\)|\.bad/)).toBeNull();
});

// BDD: FRONT-034
it("preserves HTML-like text inside Markdown code spans and fences", async () => {
  const view = await render(
    <MarkdownText
      content={"Use `<div>` as a container.\n```\n<script>example</script>\n```"}
    />,
  );

  expect(view.getByText("<div>")).toHaveStyle({ fontFamily: "monospace" });
  expect(view.getByText("<script>example</script>")).toHaveStyle({
    fontFamily: "monospace",
  });
});

// BDD: FRONT-034
it("keeps Markdown code intact while normalizing surrounding legacy HTML", async () => {
  const view = await render(
    <MarkdownText content={"<p>Use `<div>` safely.</p>"} />,
  );

  expect(view.getByText("<div>")).toHaveStyle({ fontFamily: "monospace" });
  expect(view.queryByText(/<p>/)).toBeNull();
});
