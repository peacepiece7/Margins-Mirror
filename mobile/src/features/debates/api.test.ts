import { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@/shared/api/client";
import { createDebatesApi } from "./api";
import { debateKeys, reconcileDebateTimeline } from "./queries";

describe("debate transport", () => {
  it("serializes persona selection and debate requests", async () => {
    const client = {
      delete: jest.fn(),
      get: jest.fn(),
      patch: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      stream: jest.fn(),
    } as unknown as ApiClient;
    const api = createDebatesApi(client);
    await api.personas();
    await api.createPersona({ displayName: "Close Reader", systemPrompt: "Stay close to the text." });
    await api.recommendations(17);
    await api.createWindow(9, "Room", [2, 4]);
    await api.debateAll(3, "Prompt", [2, 4]);
    await api.streamMessage(3, "Stream prompt");
    await api.readingSession(17);
    await api.ensureQuestionDebateWindow(8);
    await api.updateWindowTitle(3, "Renamed");
    await api.archiveWindow(3);
    await api.updateMessage(6, "Edited");
    await api.deleteMessage(6);
    await api.moderationFeedback(11, "RELATED");
    expect(client.get).toHaveBeenCalledWith(
      "/api/personas/recommendations?bookId=17",
    );
    expect(client.get).toHaveBeenCalledWith("/api/personas");
    expect(client.post).toHaveBeenNthCalledWith(1, "/api/personas", {
      displayName: "Close Reader",
      systemPrompt: "Stay close to the text.",
    });
    expect(client.post).toHaveBeenNthCalledWith(2, "/api/session-windows", {
      personaIds: [2, 4],
      sessionId: 9,
      title: "Room",
      windowType: "debate",
    });
    expect(client.post).toHaveBeenNthCalledWith(
      3,
      "/api/session-windows/3/debate/all",
      { content: "Prompt", personaIds: [2, 4] },
    );
    expect(client.stream).toHaveBeenCalledWith(
      "/api/session-windows/3/messages/stream",
      { content: "Stream prompt" },
      undefined,
      undefined,
    );
    expect(client.get).toHaveBeenCalledWith("/api/books/17/reading-session");
    expect(client.put).toHaveBeenCalledWith("/api/questions/8/debate-window");
    expect(client.patch).toHaveBeenNthCalledWith(
      1,
      "/api/session-windows/3/title",
      { title: "Renamed" },
    );
    expect(client.delete).toHaveBeenNthCalledWith(
      1,
      "/api/session-windows/3",
    );
    expect(client.patch).toHaveBeenNthCalledWith(2, "/api/messages/6", {
      content: "Edited",
    });
    expect(client.delete).toHaveBeenNthCalledWith(2, "/api/messages/6");
    expect(client.post).toHaveBeenLastCalledWith(
      "/api/moderation-events/11/feedback",
      { feedback: "RELATED" },
    );
  });
  it("invalidates the authoritative timeline after any debate outcome", async () => {
    const qc = new QueryClient();
    const invalidate = jest.spyOn(qc, "invalidateQueries");
    await reconcileDebateTimeline(qc, 9);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: debateKeys.timeline(9),
    });
    qc.clear();
  });
});
