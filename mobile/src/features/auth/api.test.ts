import * as WebBrowser from 'expo-web-browser';

import {
  authApi,
  createGoogleOAuthVerifier,
  requestHostedEmailVerification,
} from './api';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { BASE64: 'base64' },
  digestStringAsync: jest.fn().mockResolvedValue('ZGV2aWNlLWNoYWxsZW5nZQ=='),
  getRandomBytesAsync: jest.fn(async () => Uint8Array.from({ length: 32 }, (_, index) => index)),
}));

function response(data: unknown) {
  return new Response(JSON.stringify({ data, error: null, success: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

describe('native auth api', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('preserves the email verification, consent intent, and registration order contracts', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ available: true, email: 'reader@example.com' }))
      .mockResolvedValueOnce(response({ email: 'reader@example.com', resendAfterSeconds: 60 }))
      .mockResolvedValueOnce(response({ email: 'reader@example.com', verified: true }))
      .mockResolvedValueOnce(response({ registrationIntentToken: 'intent' }));

    await authApi.checkEmailAvailability('reader@example.com');
    await authApi.requestEmailVerification('reader@example.com');
    await authApi.confirmEmailVerification('reader@example.com', '123456');
    await authApi.createRegistrationIntent({
      ageOver14Confirmed: true,
      aiTransferAccepted: true,
      aiTransferVersion: '2026-08-24',
      privacyPolicyAccepted: true,
      privacyPolicyVersion: '2026-08-24',
    });

    expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/api/mobile/auth/email-availability',
      '/api/auth/email-verifications',
      '/api/auth/email-verifications/confirm',
      '/api/mobile/auth/registration-intents',
    ]);
    const [availabilityUrl, availabilityInit] = fetchMock.mock.calls[0];
    expect(availabilityUrl).not.toContain('reader@example.com');
    expect(JSON.parse(availabilityInit.body)).toEqual({ email: 'reader@example.com' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      botChallengeToken: 'native-development',
      email: 'reader@example.com',
    });
  });

  it('returns the callback code to the single session owner without exchanging it', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'margins://oauth/google?code=short-lived-code',
    });
    await expect(authApi.startGoogleOAuth('device-challenge')).resolves.toBe('short-lived-code');

    const [startUrl, redirectUri] = (WebBrowser.openAuthSessionAsync as jest.Mock).mock.calls[0];
    expect(new URL(startUrl).pathname).toBe('/api/mobile/auth/oauth/google/start');
    expect(new URL(startUrl).searchParams.get('codeChallenge')).toBe('device-challenge');
    expect(redirectUri).toBe('margins://oauth/google');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a high-entropy device verifier and exchanges the code with it in JSON only', async () => {
    const proof = await createGoogleOAuthVerifier();
    expect(proof.verifier).toHaveLength(43);
    expect(proof.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(proof.challenge).toBe('ZGV2aWNlLWNoYWxsZW5nZQ');

    fetchMock.mockResolvedValueOnce(response({ status: 'REGISTRATION_REQUIRED' }));
    await authApi.exchangeGoogleOAuth('captured-code', proof.verifier);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      code: 'captured-code',
      verifier: proof.verifier,
    });
  });

  it('keeps email and the native bridge proof out of the hosted challenge and return URLs', async () => {
    fetchMock
      .mockResolvedValueOnce(response({
        bridgeId: 'bridge-id',
        expiresInSeconds: 240,
        hostedUrl: 'https://api.margins.cloud/api/auth/mobile/email-verification-bridge/bridge-id',
        nativeProof: 'native-secret-proof',
      }))
      .mockResolvedValueOnce(response({
        email: 'reader@example.com',
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      }));
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'https://margins.cloud/oauth/email-verification',
    });

    await requestHostedEmailVerification(
      'reader@example.com',
      'https://margins.cloud/oauth/email-verification',
    );

    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://api.margins.cloud/api/auth/mobile/email-verification-bridge/bridge-id',
      'https://margins.cloud/oauth/email-verification',
    );
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls.join(' ')).not.toContain('reader@example.com');
    expect(requestedUrls.join(' ')).not.toContain('native-secret-proof');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      bridgeId: 'bridge-id',
      email: 'reader@example.com',
      nativeProof: 'native-secret-proof',
    });
  });

  it('rejects an unexpected browser callback before redeeming the bridge', async () => {
    fetchMock.mockResolvedValueOnce(response({
      bridgeId: 'bridge-id',
      expiresInSeconds: 240,
      hostedUrl: 'https://api.margins.cloud/api/auth/mobile/email-verification-bridge/bridge-id',
      nativeProof: 'native-secret-proof',
    }));
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'https://evil.example/oauth/email-verification',
    });

    await expect(requestHostedEmailVerification(
      'reader@example.com',
      'https://margins.cloud/oauth/email-verification',
    )).rejects.toMatchObject({ code: 'AUTH_BOT_CHALLENGE_INVALID' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // BDD: AUTH-009
  it('creates a fresh hosted challenge bridge after every browser outcome', async () => {
    fetchMock
      .mockResolvedValueOnce(response({
        bridgeId: 'cancelled-bridge',
        expiresInSeconds: 240,
        hostedUrl: 'https://api.margins.cloud/api/auth/mobile/email-verification-bridge/cancelled',
        nativeProof: 'cancelled-proof',
      }))
      .mockResolvedValueOnce(response({
        bridgeId: 'fresh-bridge',
        expiresInSeconds: 240,
        hostedUrl: 'https://api.margins.cloud/api/auth/mobile/email-verification-bridge/fresh',
        nativeProof: 'fresh-proof',
      }))
      .mockResolvedValueOnce(response({
        email: 'reader@example.com',
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      }));
    (WebBrowser.openAuthSessionAsync as jest.Mock)
      .mockResolvedValueOnce({ type: 'cancel' })
      .mockResolvedValueOnce({
        type: 'success',
        url: 'https://margins.cloud/oauth/email-verification',
      });

    await expect(requestHostedEmailVerification(
      'reader@example.com',
      'https://margins.cloud/oauth/email-verification',
    )).rejects.toMatchObject({ code: 'AUTH_BOT_CHALLENGE_CANCELLED' });
    await expect(requestHostedEmailVerification(
      'reader@example.com',
      'https://margins.cloud/oauth/email-verification',
    )).resolves.toMatchObject({ email: 'reader@example.com' });

    expect(WebBrowser.openAuthSessionAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/cancelled'),
      'https://margins.cloud/oauth/email-verification',
    );
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/fresh'),
      'https://margins.cloud/oauth/email-verification',
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      bridgeId: 'fresh-bridge',
      nativeProof: 'fresh-proof',
    });
  });
});
