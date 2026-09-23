import type { ReactNode } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/shared/theme/tokens";
import { AppText } from "@/shared/ui";

const inlineToken = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/gi;
const linkToken = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i;
const legacyHtmlToken = /<\/?[a-z][^>]*>/i;

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity, token: string) => {
    if (token.startsWith("#")) {
      const hexadecimal = token[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return namedEntities[token.toLowerCase()] ?? entity;
  });
}

function stripTags(value: string) {
  return value.replace(/<\/?[a-z][^>]*>/gi, "");
}

function protectMarkdownCode(content: string) {
  const fragments: string[] = [];
  let marker = "MARGINS_PROTECTED_CODE_";
  while (content.includes(marker)) marker += "_";
  const protect = (fragment: string) => {
    const token = `${marker}${fragments.length}_END`;
    fragments.push(fragment);
    return token;
  };
  const protectedContent = content
    .replace(/```[\s\S]*?```/g, protect)
    .replace(/`[^`\n]+`/g, protect);
  return {
    content: protectedContent,
    restore(value: string) {
      return fragments.reduce(
        (restored, fragment, index) =>
          restored.replace(`${marker}${index}_END`, fragment),
        value,
      );
    },
  };
}

export function normalizeReviewContent(content: string) {
  const protectedCode = protectMarkdownCode(content);
  if (!legacyHtmlToken.test(protectedCode.content)) return content;

  const withoutExecutableBlocks = protectedCode.content.replace(
    /<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
    "",
  );
  const withSafeLinks = withoutExecutableBlocks.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi,
    (_match, attributes: string, body: string) => {
      const label = decodeHtmlEntities(stripTags(body)).trim();
      const href = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const url = href?.[1] ?? href?.[2] ?? href?.[3];
      return url && /^https?:\/\//i.test(url) ? `[${label}](${url})` : label;
    },
  );
  return protectedCode.restore(decodeHtmlEntities(
    withSafeLinks
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<h2\b[^>]*>/gi, "\n## ")
      .replace(/<h3\b[^>]*>/gi, "\n### ")
      .replace(/<blockquote\b[^>]*>/gi, "\n> ")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<\/?(?:strong|b)\b[^>]*>/gi, "**")
      .replace(/<\/?(?:em|i)\b[^>]*>/gi, "*")
      .replace(/<\/(?:p|h2|h3|blockquote|li|ul|ol)\s*>/gi, "\n")
      .replace(/<\/?[a-z][^>]*>/gi, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  ));
}

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(inlineToken).filter(Boolean).map((part, index) => {
    const link = part.match(linkToken);
    if (link) {
      return (
        <AppText
          accessibilityRole="link"
          key={`${index}-${part}`}
          onPress={() => void Linking.openURL(link[2])}
          style={styles.link}
        >
          {link[1]}
        </AppText>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <AppText key={`${index}-${part}`} style={styles.strong}>{part.slice(2, -2)}</AppText>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <AppText key={`${index}-${part}`} style={styles.emphasis}>{part.slice(1, -1)}</AppText>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <AppText key={`${index}-${part}`} style={styles.inlineCode}>{part.slice(1, -1)}</AppText>;
    }
    return part;
  });
}

function markdownLines(content: string) {
  let inCodeBlock = false;
  return content.split("\n").flatMap((rawLine, index) => {
    if (rawLine.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      return [];
    }
    return [{ code: inCodeBlock, index, rawLine }];
  });
}

export function MarkdownText({ content }: { content: string }) {
  const normalizedContent = normalizeReviewContent(content);
  return (
    <View style={styles.container} testID="markdown-content">
      {markdownLines(normalizedContent).map(({ code, index, rawLine }) => {
        if (code) {
          return <AppText key={`code-${index}`} style={styles.codeBlock}>{rawLine || "\u00a0"}</AppText>;
        }
        if (!rawLine) return <View key={`space-${index}`} style={styles.paragraphBreak} testID="markdown-paragraph-break" />;

        const heading = rawLine.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          return <AppText key={`heading-${index}`} variant="heading">{inlineMarkdown(heading[2])}</AppText>;
        }
        const quote = rawLine.match(/^>\s?(.*)$/);
        if (quote) {
          return <AppText key={`quote-${index}`} style={styles.quote}>{inlineMarkdown(quote[1])}</AppText>;
        }
        const list = rawLine.match(/^[-*]\s+(.+)$/);
        if (list) {
          return <AppText key={`list-${index}`} style={styles.list}>• {inlineMarkdown(list[1])}</AppText>;
        }
        return <AppText key={`line-${index}`}>{inlineMarkdown(rawLine)}</AppText>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  codeBlock: {
    backgroundColor: colors.canvas,
    borderRadius: radius.small,
    fontFamily: "monospace",
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1,
  },
  container: { gap: spacing.x1 },
  emphasis: { fontStyle: "italic" },
  inlineCode: { backgroundColor: colors.canvas, fontFamily: "monospace" },
  link: { color: colors.link, textDecorationLine: "underline" },
  list: { paddingLeft: spacing.x3 },
  paragraphBreak: { height: spacing.x2 },
  quote: { borderLeftColor: colors.brass, borderLeftWidth: 2, paddingLeft: spacing.x3 },
  strong: { fontWeight: "700" },
});
