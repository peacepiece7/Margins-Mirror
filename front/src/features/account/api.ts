import { authJson, getJson, patchJson, postJson } from '@/lib/api-client';
import type { Account, AccountChallenge, ActionToken, ProfileResult } from '@/types/api/account';

export const accountApi = {
  get(): Promise<Account> {
    return getJson<Account>('/api/account');
  },
  updateProfile(data: {
    displayName: string;
    preferredLocale: 'ko' | 'en';
  }): Promise<ProfileResult> {
    return patchJson<ProfileResult>('/api/account/profile', data);
  },
  changePassword(data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> {
    return patchJson<void>('/api/account/password', data);
  },
  requestResignationChallenge(): Promise<AccountChallenge> {
    return postJson<AccountChallenge>('/api/account/resignation/challenges', {});
  },
  verifyResignation(challengeId: string, code: string): Promise<ActionToken> {
    return postJson<ActionToken>(`/api/account/resignation/challenges/${challengeId}/verify`, {
      code,
    });
  },
  resign(actionToken: string, reason: string): Promise<void> {
    return postJson<void>('/api/account/resignation', { actionToken, survey: { reason } });
  },
  requestRecovery(email: string): Promise<AccountChallenge> {
    return authJson<AccountChallenge>({
      url: '/api/account/recovery/challenges',
      method: 'POST',
      data: { email },
    });
  },
  verifyRecovery(challengeId: string, code: string): Promise<ActionToken> {
    return authJson<ActionToken>({
      url: `/api/account/recovery/challenges/${challengeId}/verify`,
      method: 'POST',
      data: { code },
    });
  },
  recover(
    email: string,
    actionToken: string,
    action: 'RESTORE' | 'ERASE_ALL_ACTIVITY',
  ): Promise<void> {
    return authJson<void>({
      url: '/api/account/recovery',
      method: 'POST',
      data: { email, actionToken, action },
    });
  },
};
