import type { ApiClient } from "@/shared/api/client";

import { createReviewsApi } from "./api";

describe("reviews api", () => {
  it("uses the persisted public review and owned comment contracts", async () => {
    const client = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as ApiClient;
    const api = createReviewsApi(client);
    await api.list();
    await api.comments(7);
    await api.createComment(7, "reply", 3);
    await api.updateComment(7, 4, "edited");
    await api.deleteComment(7, 4);
    expect(client.get).toHaveBeenNthCalledWith(
      1,
      "/api/reading-sessions/public-reviews",
    );
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      "/api/reading-sessions/public-reviews/7/comments",
    );
    expect(client.post).toHaveBeenCalledWith(
      "/api/reading-sessions/public-reviews/7/comments",
      { content: "reply", parentCommentId: 3 },
    );
    expect(client.patch).toHaveBeenCalledWith(
      "/api/reading-sessions/public-reviews/7/comments/4",
      { content: "edited" },
    );
    expect(client.delete).toHaveBeenCalledWith(
      "/api/reading-sessions/public-reviews/7/comments/4",
    );
  });
});
