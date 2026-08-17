import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Account } from '@/types/api/account';
import { protectedQueryRoots } from '@/lib/query-keys';

import { accountApi } from './api';

export const accountKeys = {
  all: protectedQueryRoots.account,
  detail: () => [...accountKeys.all, 'detail'] as const,
};

export const accountQueryOptions = queryOptions({
  queryKey: accountKeys.detail(),
  queryFn: accountApi.get,
});

export function useAccountQuery() {
  return useQuery(accountQueryOptions);
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { displayName: string }) => accountApi.updateProfile(data),
    onSuccess: ({ account }) => queryClient.setQueryData<Account>(accountKeys.detail(), account),
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      accountApi.changePassword(data),
  });
}

export function useRequestResignationChallengeMutation() {
  return useMutation({ mutationFn: () => accountApi.requestResignationChallenge() });
}

export function useResignMutation() {
  return useMutation({
    mutationFn: async ({
      challengeId,
      code,
      reason,
    }: {
      challengeId: string;
      code: string;
      reason: string;
    }) => {
      const verified = await accountApi.verifyResignation(challengeId, code);
      return accountApi.resign(verified.actionToken, reason);
    },
  });
}

export function useRequestRecoveryMutation() {
  return useMutation({ mutationFn: (email: string) => accountApi.requestRecovery(email) });
}

export function useVerifyRecoveryMutation() {
  return useMutation({
    mutationFn: ({ challengeId, code }: { challengeId: string; code: string }) =>
      accountApi.verifyRecovery(challengeId, code),
  });
}

export function useRecoverMutation() {
  return useMutation({
    mutationFn: ({
      email,
      actionToken,
      action,
    }: {
      email: string;
      actionToken: string;
      action: 'RESTORE' | 'ERASE_ALL_ACTIVITY';
    }) => accountApi.recover(email, actionToken, action),
  });
}
