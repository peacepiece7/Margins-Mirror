import type { ApiClient } from "@/shared/api/client";

import { createAccountApi } from "./api";

describe("account api", () => {
  // BDD: ACCOUNT-001
  it("keeps protected account changes bearer-backed and recovery public", async () => {
    const client = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
    } as unknown as ApiClient;
    const api = createAccountApi(client);
    await api.get();
    await api.updateProfile({ displayName: "Reader", preferredLocale: "en" });
    await api.requestRecovery("reader@example.com");
    await api.verifyRecovery("challenge", "123456");
    await api.recover("reader@example.com", "action", "RESTORE");
    expect(client.get).toHaveBeenCalledWith("/api/account");
    expect(client.patch).toHaveBeenCalledWith("/api/account/profile", {
      displayName: "Reader",
      preferredLocale: "en",
    });
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      "/api/account/recovery/challenges",
      { email: "reader@example.com" },
      { auth: false },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      "/api/account/recovery/challenges/challenge/verify",
      { code: "123456" },
      { auth: false },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      3,
      "/api/account/recovery",
      { email: "reader@example.com", actionToken: "action", action: "RESTORE" },
      { auth: false },
    );
  });

  // BDD: ACCOUNT-003
  it("submits resignation only after challenge verification", async () => {
    const client = {
      post: jest.fn().mockResolvedValueOnce({ actionToken: "verified" }),
    } as unknown as ApiClient;
    const api = createAccountApi(client);
    const verified = await api.verifyResignation("challenge", "123456");
    await api.resign(verified.actionToken, "PRIVACY_CONCERNS");
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      "/api/account/resignation/challenges/challenge/verify",
      { code: "123456" },
    );
    expect(client.post).toHaveBeenNthCalledWith(2, "/api/account/resignation", {
      actionToken: "verified",
      survey: { reason: "PRIVACY_CONCERNS" },
    });
  });
});
