package com.margins.ai;

/** AI 요청의 독립 컨텍스트 영역을 안정된 순서로 렌더링한다. */
public record PromptContextPack(
    String bookContext,
    String readerContext,
    String conversationContext
) {
    public String render() {
        StringBuilder output = new StringBuilder("AI Context Pack\n");
        append(output, "Book Context", bookContext);
        append(output, "Reader Context", readerContext);
        append(output, "Conversation", conversationContext);
        return output.toString();
    }

    private void append(StringBuilder output, String heading, String content) {
        if (content == null || content.isBlank()) {
            return;
        }
        output.append(heading).append(":\n").append(content.strip()).append('\n');
    }
}
