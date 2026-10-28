import type { ReadingSessionTimeline } from "./types";

export function readingSessionTranscript(timeline: ReadingSessionTimeline) {
  const lines = [
    `# ${timeline.title}`,
    "",
    `**Book:** ${timeline.bookTitle}${timeline.bookAuthor ? ` — ${timeline.bookAuthor}` : ""}`,
    "",
  ];
  for (const window of timeline.windows) {
    lines.push(`## ${window.title}`, "");
    const questions = timeline.questions.filter((question) => question.windowId === window.windowId);
    if (questions.length) {
      lines.push("### Questions", ...questions.map((question) => `- ${question.questionText} (${question.status})`), "");
    }
    const messages = timeline.messages.filter((message) => message.windowId === window.windowId);
    if (messages.length) {
      lines.push("### Messages", ...messages.map((message) => `**${message.role}:** ${message.content}`), "");
    }
  }
  if (timeline.highlights.length) {
    lines.push("## Highlights", ...timeline.highlights.map((item) => `> ${item.quoteText}${item.note ? `\n> ${item.note}` : ""}`), "");
  }
  if (timeline.insights.length) {
    lines.push("## Saved Notes", ...timeline.insights.map((item) => item.content), "");
  }
  return lines.join("\n").trim();
}
