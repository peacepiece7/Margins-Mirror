import type { ApiClient } from "@/shared/api/client";

import { createMemoryCardsApi } from "./api";

describe("memory cards api", () => {
  // BDD: MEM-009
  // BDD: MEM-001, MEM-004 - native commands preserve the accepted backend
  // endpoints; Premium authorization remains enforced by that backend boundary.
  it("maps group/card CRUD, bulk import and memorized state without an export endpoint", async () => {
    const client = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as ApiClient;
    const api = createMemoryCardsApi(client);
    const card = { frontText: "margin", backText: "여백" };
    await api.groups();
    await api.groups(7);
    await api.group(2);
    await api.createGroup({ bookId: 7, title: "Words" });
    await api.updateGroup(2, { title: "Terms" });
    await api.createCard(2, card);
    await api.bulkCards(2, [card], "ignore");
    await api.updateCard(9, card);
    await api.memorize(9, true);
    await api.deleteCard(9);
    await api.deleteGroup(2);
    expect(client.post).toHaveBeenCalledWith(
      "/api/memory-card-groups",
      { bookId: 7, title: "Words" },
    );
    expect(client.get).toHaveBeenCalledWith("/api/memory-card-groups?bookId=7");
    expect(client.post).toHaveBeenCalledWith(
      "/api/memory-card-groups/2/cards/bulk",
      { cards: [card], duplicatePolicy: "ignore" },
    );
    expect(client.patch).toHaveBeenCalledWith("/api/memory-cards/9/memorized", {
      memorized: true,
    });
    expect(client.delete).toHaveBeenCalledWith("/api/memory-card-groups/2");
  });
});
