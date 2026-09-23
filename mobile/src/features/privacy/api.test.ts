import type { ApiClient } from "@/shared/api/client";

import { createPrivacyApi } from "./api";

describe("privacy api", () => {
  it("loads public requirements without auth and grants consent with bearer auth", async () => {
    const client = { get: jest.fn(), post: jest.fn() } as unknown as ApiClient;
    const api = createPrivacyApi(client);
    const request = {
      privacyPolicyAccepted: true,
      aiTransferAccepted: true,
      ageOver14Confirmed: true,
      privacyPolicyVersion: "v1",
      aiTransferVersion: "v2",
      preferredLocale: "ko" as const,
    };
    await api.requirements();
    await api.status();
    await api.grant(request);
    expect(client.get).toHaveBeenNthCalledWith(1, "/api/privacy/requirements", {
      auth: false,
    });
    expect(client.get).toHaveBeenNthCalledWith(2, "/api/privacy/consents");
    expect(client.post).toHaveBeenCalledWith("/api/privacy/consents", request);
  });
});
