import { QueryClient } from "@tanstack/react-query";

import { replaceReviewCommentThread, reviewKeys } from "./queries";

describe("review comment cache", () => {
  // BDD: FRONT-132, FRONT-134, FRONT-135
  // BDD: FRONT-134
  // BDD: FRONT-135
  it("replaces only the authoritative thread returned by a mutation", () => {
    const client = new QueryClient();
    client.setQueryData(reviewKeys.comments(7), { insightId: 7, comments: [] });
    client.setQueryData(reviewKeys.comments(8), { insightId: 8, comments: [{ commentId: 80 }] });
    const response = {
      insightId: 7,
      comments: [{ commentId: 10, insightId: 7, content: "Saved", ownedByCurrentReader: true }],
    };

    replaceReviewCommentThread(client, 7, response);

    expect(client.getQueryData(reviewKeys.comments(7))).toEqual(response);
    expect(client.getQueryData(reviewKeys.comments(8))).toEqual({ insightId: 8, comments: [{ commentId: 80 }] });
    client.clear();
  });
});
