import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ApiClientProvider } from "@/shared/api/api-client-provider";
import type { ApiClient } from "@/shared/api/client";

import { useAccountMutations, useRecoveryMutations } from "./queries";
import type {
  Account,
  AccountChallenge,
  ActionToken,
  ProfileResult,
} from "./types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

// BDD: ACCOUNT-015
it("keeps profile command state in Query and replaces the cache with the authoritative response", async () => {
  const response = deferred<ProfileResult>();
  const client = {
    patch: jest.fn().mockReturnValue(response.promise),
  } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const original: Account = {
    accountStatus: "ACTIVE",
    authProvider: "local",
    displayName: "Local draft",
    email: "reader@example.com",
    preferredLocale: "en",
    userId: 1,
    username: "reader",
  };
  const authoritative: Account = {
    ...original,
    displayName: "Server-normalized reader",
  };
  queryClient.setQueryData(["account", "detail"], original);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useAccountMutations(), { wrapper });
  let mutation!: Promise<ProfileResult>;

  await act(async () => {
    mutation = hook.result.current.profile.mutateAsync({
      displayName: "Local draft",
      preferredLocale: "en",
    });
    await Promise.resolve();
  });
  await waitFor(() => expect(hook.result.current.profile.isPending).toBe(true));
  expect(queryClient.getQueryData(["account", "detail"])).toEqual(original);

  await act(async () => {
    response.resolve({ account: authoritative });
    await mutation;
  });

  await waitFor(() => expect(hook.result.current.profile.isPending).toBe(false));
  expect(queryClient.getQueryData(["account", "detail"])).toEqual(
    authoritative,
  );
  hook.unmount();
  queryClient.clear();
});

// BDD: ACCOUNT-003
it("verifies the resignation challenge before submitting its one-time action token", async () => {
  const client = {
    post: jest
      .fn()
      .mockResolvedValueOnce({ actionToken: "verified", expiresInSeconds: 300 })
      .mockResolvedValueOnce(undefined),
  } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useAccountMutations(), { wrapper });

  await act(async () => {
    await hook.result.current.verifyResignation.mutateAsync({
      challengeId: "challenge-1",
      code: "123456",
    });
  });
  await waitFor(() =>
    expect(hook.result.current.verifyResignation.data).toEqual({
      actionToken: "verified",
      expiresInSeconds: 300,
    }),
  );
  await act(async () => {
    await hook.result.current.resign.mutateAsync({
      actionToken: hook.result.current.verifyResignation.data!.actionToken,
      reason: "PRIVACY_CONCERNS",
    });
  });

  expect(client.post).toHaveBeenNthCalledWith(
    1,
    "/api/account/resignation/challenges/challenge-1/verify",
    { code: "123456" },
  );
  expect(client.post).toHaveBeenNthCalledWith(2, "/api/account/resignation", {
    actionToken: "verified",
    survey: { reason: "PRIVACY_CONCERNS" },
  });
  hook.unmount();
  queryClient.clear();
});

// BDD: ACCOUNT-015
it("keeps recovery challenge, action-token, and command status in Query mutations", async () => {
  const challenge = deferred<AccountChallenge>();
  const verified = deferred<ActionToken>();
  const recovered = deferred<void>();
  const client = {
    post: jest
      .fn()
      .mockReturnValueOnce(challenge.promise)
      .mockReturnValueOnce(verified.promise)
      .mockReturnValueOnce(recovered.promise),
  } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientProvider>
  );
  const hook = await renderHook(() => useRecoveryMutations(), { wrapper });
  let challengeMutation!: Promise<AccountChallenge>;
  let verifyMutation!: Promise<ActionToken>;
  let recoverMutation!: Promise<void>;

  await act(async () => {
    challengeMutation = hook.result.current.challenge.mutateAsync(
      "reader@example.com",
    );
    await Promise.resolve();
  });
  await waitFor(() => expect(hook.result.current.challenge.isPending).toBe(true));
  await act(async () => {
    challenge.resolve({ challengeId: "challenge-1", expiresInSeconds: 300 });
    await challengeMutation;
  });
  await waitFor(() =>
    expect(hook.result.current.challenge.data?.challengeId).toBe("challenge-1"),
  );

  await act(async () => {
    verifyMutation = hook.result.current.verify.mutateAsync({
      challengeId: hook.result.current.challenge.data!.challengeId,
      code: "123456",
    });
    await Promise.resolve();
  });
  await waitFor(() => expect(hook.result.current.verify.isPending).toBe(true));
  await act(async () => {
    verified.resolve({ actionToken: "single-use", expiresInSeconds: 300 });
    await verifyMutation;
  });
  await waitFor(() =>
    expect(hook.result.current.verify.data?.actionToken).toBe("single-use"),
  );

  await act(async () => {
    recoverMutation = hook.result.current.recover.mutateAsync({
      action: "RESTORE",
      actionToken: hook.result.current.verify.data!.actionToken,
      email: "reader@example.com",
    });
    await Promise.resolve();
  });
  await waitFor(() => expect(hook.result.current.recover.isPending).toBe(true));
  recovered.resolve(undefined);
  await act(async () => recoverMutation);
  await waitFor(() => expect(hook.result.current.recover.isPending).toBe(false));

  expect(client.post).toHaveBeenNthCalledWith(
    1,
    "/api/account/recovery/challenges",
    { email: "reader@example.com" },
    { auth: false },
  );
  expect(client.post).toHaveBeenNthCalledWith(
    2,
    "/api/account/recovery/challenges/challenge-1/verify",
    { code: "123456" },
    { auth: false },
  );
  expect(client.post).toHaveBeenNthCalledWith(
    3,
    "/api/account/recovery",
    {
      action: "RESTORE",
      actionToken: "single-use",
      email: "reader@example.com",
    },
    { auth: false },
  );
  hook.unmount();
  queryClient.clear();
});
