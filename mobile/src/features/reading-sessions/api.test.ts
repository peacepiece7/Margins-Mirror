import type { ApiClient } from "@/shared/api/client";

import { createReadingSessionsApi } from "./api";

describe("reading sessions transport", () => {
  it("serializes endpoint paths and request bodies", async () => {
    const client = {
      delete: jest.fn(),
      get: jest.fn(),
      patch: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      stream: jest.fn(),
    } as unknown as ApiClient;
    const api = createReadingSessionsApi(client);
    await api.createSession(4, "Dune reflection");
    await api.createWindow(9, "Questions");
    await api.updateWindowTitle(7, "Renamed");
    await api.archiveWindow(7);
    await api.createQuestion(7, "What changed?");
    await api.deleteQuestion(8);
    await api.generateQuestions(7, "bookId=4");
    await api.updateMessage(6, "Edited");
    await api.deleteMessage(6);
    await api.archiveSession(9);
    await api.streamAnswer(7, 8, "My answer");
    const controller = new AbortController();
    await api.streamAnswer(7, 8, "Cancelable answer", undefined, controller.signal);
    await api.readingSession(4);
    await api.ensureReadingSession(4);
    await api.createHighlight(9, { quoteText: "Line", pageNumber: 3 });
    await api.createTag(9, "ethics");
    await api.latestTimeline();
    await api.search("Dune & ritual");
    await api.createMetricSnapshot(9);
    await api.updateHighlight(9, 3, { quoteText: "Changed" });
    await api.deleteHighlight(9, 3);
    await api.deleteTag(9, 4);
    await api.updateInsight(9, 5, { content: "Changed insight" });
    await api.deleteInsight(9, 5);
    expect(client.get).toHaveBeenCalledWith("/api/books/4/reading-session");
    expect(client.put).toHaveBeenCalledWith("/api/books/4/reading-session");
    expect(client.post).toHaveBeenCalledWith("/api/reading-sessions", {
      bookId: 4,
      title: "Dune reflection",
    });
    expect(client.post).toHaveBeenCalledWith("/api/session-windows", {
      sessionId: 9,
      title: "Questions",
      windowType: "question",
    });
    expect(client.patch).toHaveBeenCalledWith("/api/session-windows/7/title", { title: "Renamed" });
    expect(client.delete).toHaveBeenCalledWith("/api/session-windows/7");
    expect(client.post).toHaveBeenCalledWith("/api/session-windows/7/questions", { questionText: "What changed?" });
    expect(client.delete).toHaveBeenCalledWith("/api/questions/8");
    expect(client.post).toHaveBeenCalledWith("/api/session-windows/7/questions/generate", { count: 3, focus: "bookId=4" });
    expect(client.patch).toHaveBeenCalledWith("/api/messages/6", { content: "Edited" });
    expect(client.delete).toHaveBeenCalledWith("/api/messages/6");
    expect(client.delete).toHaveBeenCalledWith("/api/reading-sessions/9");
    expect(client.stream).toHaveBeenCalledWith(
      "/api/session-windows/7/messages/stream",
      { content: "My answer", questionId: 8 },
      undefined,
      undefined,
    );
    expect(client.stream).toHaveBeenCalledWith(
      "/api/session-windows/7/messages/stream",
      { content: "Cancelable answer", questionId: 8 },
      undefined,
      controller.signal,
    );
    expect(client.post).toHaveBeenCalledWith(
      "/api/reading-sessions/9/highlights",
      { quoteText: "Line", pageNumber: 3 },
    );
    expect(client.post).toHaveBeenCalledWith(
      "/api/reading-sessions/9/tags",
      { label: "ethics" },
    );
    expect(client.get).toHaveBeenCalledWith("/api/reading-sessions/latest");
    expect(client.get).toHaveBeenCalledWith("/api/reading-sessions/search?query=Dune%20%26%20ritual");
    expect(client.post).toHaveBeenCalledWith("/api/reading-sessions/9/metrics/snapshot", {});
    expect(client.patch).toHaveBeenCalledWith(
      "/api/reading-sessions/9/highlights/3",
      { quoteText: "Changed" },
    );
    expect(client.delete).toHaveBeenCalledWith("/api/reading-sessions/9/highlights/3");
    expect(client.delete).toHaveBeenCalledWith("/api/reading-sessions/9/tags/4");
    expect(client.patch).toHaveBeenCalledWith(
      "/api/reading-sessions/9/insights/5",
      { content: "Changed insight" },
    );
    expect(client.delete).toHaveBeenCalledWith("/api/reading-sessions/9/insights/5");
  });
});
