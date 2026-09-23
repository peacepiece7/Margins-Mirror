import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "@/shared/api/api-client-provider";

import { createAccountApi } from "./api";
import type { Account, RecoveryAction, ResignationReason } from "./types";

const accountKey = ["account", "detail"] as const;

export function useAccountQuery() {
  const api = createAccountApi(useApiClient());
  return useQuery({ queryKey: accountKey, queryFn: api.get });
}

export function useAccountMutations() {
  const api = createAccountApi(useApiClient());
  const queryClient = useQueryClient();
  return {
    profile: useMutation({
      mutationFn: api.updateProfile,
      onSuccess: ({ account }) =>
        queryClient.setQueryData<Account>(accountKey, account),
    }),
    password: useMutation({ mutationFn: api.changePassword }),
    challenge: useMutation({ mutationFn: api.requestResignationChallenge }),
    verifyResignation: useMutation({
      mutationFn: ({
        challengeId,
        code,
      }: {
        challengeId: string;
        code: string;
      }) => api.verifyResignation(challengeId, code),
    }),
    resign: useMutation({
      mutationFn: ({
        actionToken,
        reason,
      }: {
        actionToken: string;
        reason: ResignationReason;
      }) => api.resign(actionToken, reason),
    }),
  };
}

export function useRecoveryMutations() {
  const api = createAccountApi(useApiClient());
  return {
    challenge: useMutation({ mutationFn: api.requestRecovery }),
    verify: useMutation({
      mutationFn: ({
        challengeId,
        code,
      }: {
        challengeId: string;
        code: string;
      }) => api.verifyRecovery(challengeId, code),
    }),
    recover: useMutation({
      mutationFn: ({
        email,
        actionToken,
        action,
      }: {
        email: string;
        actionToken: string;
        action: RecoveryAction;
      }) => api.recover(email, actionToken, action),
    }),
  };
}
