import type { ApiClient } from "@/shared/api/client";

import type {
  Account,
  AccountChallenge,
  ActionToken,
  ProfileResult,
  RecoveryAction,
  ResignationReason,
} from "./types";

export function createAccountApi(client: ApiClient) {
  return {
    get: () => client.get<Account>("/api/account"),
    updateProfile: (data: {
      displayName: string;
      preferredLocale: "ko" | "en";
    }) => client.patch<ProfileResult>("/api/account/profile", data),
    changePassword: (data: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => client.patch<void>("/api/account/password", data),
    requestResignationChallenge: () =>
      client.post<AccountChallenge>("/api/account/resignation/challenges", {}),
    verifyResignation: (challengeId: string, code: string) =>
      client.post<ActionToken>(
        `/api/account/resignation/challenges/${challengeId}/verify`,
        { code },
      ),
    resign: (actionToken: string, reason: ResignationReason) =>
      client.post<void>("/api/account/resignation", {
        actionToken,
        survey: { reason },
      }),
    requestRecovery: (email: string) =>
      client.post<AccountChallenge>(
        "/api/account/recovery/challenges",
        { email },
        { auth: false },
      ),
    verifyRecovery: (challengeId: string, code: string) =>
      client.post<ActionToken>(
        `/api/account/recovery/challenges/${challengeId}/verify`,
        { code },
        { auth: false },
      ),
    recover: (email: string, actionToken: string, action: RecoveryAction) =>
      client.post<void>(
        "/api/account/recovery",
        { email, actionToken, action },
        { auth: false },
      ),
  };
}
