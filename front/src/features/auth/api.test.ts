import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authJson, rotateRefreshToken } from '@/lib/api-client';

import { authApi } from './api';

vi.mock('@/lib/api-client', () => ({
  authJson: vi.fn(),
  rotateRefreshToken: vi.fn(),
}));

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates login to the auth endpoint without owning session state', async () => {
    const response = {
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 900,
    };
    vi.mocked(authJson).mockResolvedValue(response);

    await expect(authApi.login('reader', 'password')).resolves.toEqual(response);
    expect(authJson).toHaveBeenCalledWith({
      url: '/api/auth/login',
      method: 'POST',
      data: { username: 'reader', password: 'password' },
    });
  });

  it('serializes availability input at the endpoint boundary', async () => {
    vi.mocked(authJson).mockResolvedValue({ email: 'reader+test@example.com', available: true });

    await authApi.checkEmailAvailability('reader+test@example.com');

    expect(authJson).toHaveBeenCalledWith({
      url: '/api/auth/email-availability?email=reader%2Btest%40example.com',
      method: 'GET',
    });
  });

  it('creates the required registration intent for final registration', async () => {
    vi.mocked(authJson).mockResolvedValue(undefined);
    const consent = {
      privacyPolicyAccepted: true,
      aiTransferAccepted: true,
      ageOver14Confirmed: true,
      privacyPolicyVersion: '2026-07-27',
      aiTransferVersion: '2026-07-27',
    };

    await authApi.createRegistrationIntent(consent);

    expect(authJson).toHaveBeenCalledWith({
      url: '/api/auth/registration-intents',
      method: 'POST',
      data: consent,
    });
  });

  it('sends a fresh bot challenge token with each verification request', async () => {
    vi.mocked(authJson).mockResolvedValue({
      email: 'reader@example.com',
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
    });

    await authApi.requestEmailVerification('reader@example.com', 'one-time-token');

    expect(authJson).toHaveBeenCalledWith({
      url: '/api/auth/email-verifications',
      method: 'POST',
      data: {
        email: 'reader@example.com',
        botChallengeToken: 'one-time-token',
      },
    });
  });

  it('delegates refresh to the shared single-flight transport', async () => {
    const response = {
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local',
      accessToken: 'rotated',
      accessTokenExpiresInSeconds: 900,
    };
    vi.mocked(rotateRefreshToken).mockResolvedValue(response);

    await expect(authApi.refresh()).resolves.toEqual(response);
    expect(rotateRefreshToken).toHaveBeenCalledOnce();
  });
});
