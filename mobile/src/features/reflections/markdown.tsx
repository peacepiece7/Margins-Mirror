import { Fragment } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/shared/theme/tokens";
import { AppText } from "@/shared/ui";

const inlinePattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\)|\*[^*]+\*)/g;

function InlineMarkdown({ value }: { value: string }) {
  return (
    <Text style={styles.inline}>
      {value.split(inlinePattern).filter(Boolean).map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <Text key={index} style={styles.bold}>{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <Text key={index} style={styles.italic}>{part.slice(1, -1)}</Text>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <Text key={index} style={styles.code}>{part.slice(1, -1)}</Text>;
        }
        const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(part);
        if (link) {
          return (
            <Text
              accessibilityRole="link"
              key={index}
              onPress={() => void Linking.openURL(link[2])}
              style={styles.link}
            >
              {link[1]}
            </Text>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </Text>
  );
}

export function ReflectionMarkdown({ content }: { content: string }) {
  const lines = parseMarkdownLines(content);
  return (
    <View accessibilityLabel="Markdown content" style={styles.container}>
      {lines.map(({ fenced, line, sourceIndex }) => {
        const index = sourceIndex;
        if (!line) return <View key={index} style={styles.paragraphBreak} />;
        if (fenced) return <AppText key={index} style={styles.code}>{line}</AppText>;
        const heading = /^#{1,6}\s+(.+)$/.exec(line);
        if (heading) return <AppText key={index} variant="heading"><InlineMarkdown value={heading[1]} /></AppText>;
        const quote = /^>\s?(.+)$/.exec(line);
        if (quote) return <View key={index} style={styles.quote}><InlineMarkdown value={quote[1]} /></View>;
        const list = /^[-*+]\s+(.+)$/.exec(line);
        if (list) return <View key={index} style={styles.list}><AppText>•</AppText><InlineMarkdown value={list[1]} /></View>;
        return <InlineMarkdown key={index} value={line} />;
      })}
    </View>
  );
}

function parseMarkdownLines(content: string) {
  let fenced = false;
  const lines: { fenced: boolean; line: string; sourceIndex: number }[] = [];
  content.split("\n").forEach((line, sourceIndex) => {
    if (line.trim().startsWith("```")) {
      fenced = !fenced;
      return;
    }
    lines.push({ fenced, line, sourceIndex });
  });
  return lines;
}

const styles = StyleSheet.create({
  bold: { fontWeight: "700" },
  code: { backgroundColor: colors.canvas, fontFamily: "monospace" },
  container: { gap: spacing.x1 },
  inline: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  italic: { fontStyle: "italic" },
  link: { color: colors.link, textDecorationLine: "underline" },
  list: { alignItems: "flex-start", flexDirection: "row", gap: spacing.x2 },
  paragraphBreak: { height: spacing.x2 },
  quote: { borderLeftColor: colors.line, borderLeftWidth: 2, paddingLeft: spacing.x3 },
});
