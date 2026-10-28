import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { GuideMarkdownExport } from "./types";

export type GuideExportAdapter = {
  share(uri: string): Promise<void>;
  write(filename: string, content: string): Promise<string>;
};

const nativeAdapter: GuideExportAdapter = {
  async share(uri) {
    if (!(await Sharing.isAvailableAsync())) throw new Error("SHARING_UNAVAILABLE");
    await Sharing.shareAsync(uri, {
      UTI: "net.daringfireball.markdown",
      dialogTitle: "Share discussion guide",
      mimeType: "text/markdown",
    });
  },
  async write(filename, content) {
    const file = new File(Paths.cache, filename);
    file.create({ intermediates: true, overwrite: true });
    file.write(content);
    return file.uri;
  },
};

export function safeMarkdownFilename(filename: string) {
  const basename = filename.split(/[\\/]/).pop() || "discussion-guide.md";
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return sanitized.toLowerCase().endsWith(".md") ? sanitized : `${sanitized}.md`;
}

export async function shareGuideMarkdown(
  exported: GuideMarkdownExport,
  adapter: GuideExportAdapter = nativeAdapter,
) {
  const filename = safeMarkdownFilename(exported.filename);
  const uri = await adapter.write(filename, exported.content);
  await adapter.share(uri);
  return { filename, uri };
}
