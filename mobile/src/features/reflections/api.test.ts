import { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@/shared/api/client";
import { createReflectionsApi } from "./api";
import { invalidateReflectionWorkflow, reflectionKeys } from "./queries";
import type { ReflectionLoop } from "./types";

describe("reflection loop transport", () => {
  // BDD: RLOOP-058
  it("serializes interview, guide, turn, and refinement endpoints", async () => {
    const client = {
      get: jest.fn(),
      patch: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    } as unknown as ApiClient;
    const api = createReflectionsApi(client);
    await api.reflectionThreads();
    await api.routeAuthority(9);
    await api.respond(12, 13, "ANSWER", "Because");
    await api.completeInterview(12);
    await api.createGuide(12, {
      audienceMode: "SELF_AI",
      disclosureMode: "REFLECTION_ONLY",
      facilitationLevel: "BEGINNER",
      purpose: "THOUGHT_EXPANSION",
      targetMinutes: 20,
    });
    await api.turn(30, "reply", "SELECT_PERSPECTIVE", 4);
    await api.saveRefinement(30, "EDITED", "CHANGED", "final");
    await api.saveAnswer(8, "answer");
    await api.updateAnswer(12, 13, "Revised", 2, "RESTART_FROM_HERE");
    expect(client.get).toHaveBeenNthCalledWith(
      1,
      "/api/mobile/reflection-threads",
    );
    expect(client.get).toHaveBeenCalledWith(
      "/api/reading-sessions/9/reflection-authority",
    );
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      "/api/reflection-interviews/12/responses",
      { content: "Because", mode: "ANSWER", questionId: 13 },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      "/api/reflection-interviews/12/complete",
      {},
    );
    expect(client.post).toHaveBeenNthCalledWith(
      4,
      "/api/discussion-runs/30/turns",
      { content: "reply", navigation: "SELECT_PERSPECTIVE", personaId: 4 },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      5,
      "/api/discussion-runs/30/refinement",
      { finalContent: "final", mode: "EDITED", outcome: "CHANGED" },
    );
    expect(client.put).toHaveBeenCalledWith("/api/questions/8/answer", {
      content: "answer",
    });
    expect(client.put).toHaveBeenCalledWith(
      "/api/reflection-interviews/12/answers/13",
      {
        content: "Revised",
        expectedAnswerVersion: 2,
        revisionKind: "RESTART_FROM_HERE",
      },
    );
  });
  it("sets saved reflection and invalidates its authoritative timeline", async () => {
    const qc = new QueryClient();
    const invalidate = jest.spyOn(qc, "invalidateQueries");
    const reflection = { reflectionId: 2, sessionId: 9 } as ReflectionLoop;
    await invalidateReflectionWorkflow(qc, reflection);
    expect(qc.getQueryData(reflectionKeys.session(9))).toStrictEqual(
      reflection,
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["reading-sessions", "timeline", 9],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: reflectionKeys.threads,
    });
    qc.clear();
  });
  it("serializes immutable guide version, projection, and export contracts", async () => {
    const client = {
      get: jest.fn().mockResolvedValue({
        bookTitle: "Margins",
        current: false,
        goal: "Discuss",
        guideId: 21,
        guideVersion: 2,
        issues: ["One", "Two"],
        items: [],
        projection: "PARTICIPANT",
      }),
      patch: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    } as unknown as ApiClient;
    const api = createReflectionsApi(client);
    await api.guideVersions(12);
    await api.guideProjection(21, "PARTICIPANT");
    await api.guideMarkdown(21, "FACILITATOR");
    await api.editGuide(21, {
      expectedVersion: 2,
      goal: "New goal",
      issues: ["One", "Two"],
      items: [],
    });
    await api.regenerateGuide(21, {
      brief: {
        audienceMode: "SELF_AI",
        disclosureMode: "REFLECTION_ONLY",
        facilitationLevel: "BEGINNER",
        purpose: "THOUGHT_EXPANSION",
        targetMinutes: 20,
      },
      expectedVersion: 2,
    });

    expect(client.get).toHaveBeenNthCalledWith(
      1,
      "/api/reflection-interviews/12/guides",
    );
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      "/api/discussion-guides/21/projections/PARTICIPANT",
    );
    expect(client.get).toHaveBeenNthCalledWith(
      3,
      "/api/discussion-guides/21/exports/markdown?projection=FACILITATOR",
    );
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      "/api/discussion-guides/21/versions",
      expect.objectContaining({ expectedVersion: 2 }),
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      "/api/discussion-guides/21/regenerate",
      expect.objectContaining({ expectedVersion: 2 }),
    );
  });
});
