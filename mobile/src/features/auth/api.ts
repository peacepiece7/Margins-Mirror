import { publicApiClient } from '@/shared/api/client';
import { ApiRequestError } from '@/shared/api/error';
import {
  apiBaseUrl,
  emailVerificationRedirectUri,
  oauthRedirectUri,
} from '@/shared/config';
import * as WebBrowser from 'expo-web-browser';
import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
  getRandomBytesAsync,
} from 'expo-crypto';

import type {
  ConsentInput,
  EmailAvailability,
  EmailVerification,
  EmailVerificationConfirmation,
  LoginInput,
  GoogleOAuthExchange,
  GoogleOAuthVerifier,
  GoogleRegistrationInput,
  NativeSessionResponse,
  NativeTurnstileBridge,
  RegistrationInput,
  RegistrationIntent,
  PrivacyRequirements,
} from './types';

function base64Url(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += alphabet[first >> 2];
    result += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
    if (second !== undefined) {
      result += alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
    }
    if (third !== undefined) result += alphabet[third & 63];
  }
  return result;
}

export async function createGoogleOAuthVerifier(): Promise<GoogleOAuthVerifier> {
  const verifier = base64Url(await getRandomBytesAsync(32));
  const digest = await digestStringAsync(CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: CryptoEncoding.BASE64,
  });
  return {
    challenge: digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    verifier,
  };
}

function requireHostedChallengeUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new ApiRequestError({
      code: 'AUTH_BOT_CHALLENGE_UNAVAILABLE',
      status: 503,
    });
  }
  return url.toString();
}

function isExpectedRedirect(value: string, expected: string) {
  const actualUrl = new URL(value);
  const expectedUrl = new URL(expected);
  return (
    actualUrl.protocol === expectedUrl.protocol &&
    actualUrl.host === expectedUrl.host &&
    actualUrl.pathname.replace(/\/$/, '') === expectedUrl.pathname.replace(/\/$/, '') &&
    !actualUrl.search &&
    !actualUrl.hash
  );
}

export async function requestHostedEmailVerification(email: string, redirectUri: string) {
  const bridge = await authApi.createEmailVerificationBridge(email);
  const result = await WebBrowser.openAuthSessionAsync(
    requireHostedChallengeUrl(bridge.hostedUrl),
    redirectUri,
  );
  if (result.type !== 'success') {
    throw new ApiRequestError({
      code: 'AUTH_BOT_CHALLENGE_CANCELLED',
      status: 400,
    });
  }
  if (!isExpectedRedirect(result.url, redirectUri)) {
    throw new ApiRequestError({
      code: 'AUTH_BOT_CHALLENGE_INVALID',
      status: 400,
    });
  }
  return authApi.redeemEmailVerificationBridge(email, bridge);
}

export const authApi = {
  checkEmailAvailability(email: string) {
    return publicApiClient.post<EmailAvailability>('/api/mobile/auth/email-availability', { email }, {
      auth: false,
    });
  },
  confirmEmailVerification(email: string, code: string) {
    return publicApiClient.post<EmailVerificationConfirmation>(
      '/api/auth/email-verifications/confirm',
      { code, email },
      { auth: false },
    );
  },
  createRegistrationIntent(input: ConsentInput) {
    return publicApiClient.post<RegistrationIntent>(
      '/api/mobile/auth/registration-intents',
      input,
      { auth: false },
    );
  },
  login(input: LoginInput) {
    return publicApiClient.post<NativeSessionResponse>('/api/mobile/auth/login', input, { auth: false });
  },
  getPrivacyRequirements() {
    return publicApiClient.get<PrivacyRequirements>('/api/privacy/requirements', { auth: false });
  },
  async startGoogleOAuth(codeChallenge: string) {
    if (!oauthRedirectUri) {
      throw new ApiRequestError({ code: 'AUTH_GOOGLE_NOT_CONFIGURED', status: 503 });
    }
    const startUrl = new URL('/api/mobile/auth/oauth/google/start', apiBaseUrl);
    startUrl.searchParams.set('redirectUri', oauthRedirectUri);
    startUrl.searchParams.set('codeChallenge', codeChallenge);
    const result = await WebBrowser.openAuthSessionAsync(startUrl.toString(), oauthRedirectUri);
    if (result.type !== 'success') {
      throw new ApiRequestError({
        code:
          result.type === 'cancel'
            ? 'AUTH_GOOGLE_OAUTH_CANCELLED'
            : 'AUTH_GOOGLE_OAUTH_REQUEST_INVALID',
        status: 400,
      });
    }
    const callback = new URL(result.url);
    const error = callback.searchParams.get('error');
    if (error) throw new ApiRequestError({ code: error, status: 400 });
    const code = callback.searchParams.get('code');
    if (!code) {
      throw new ApiRequestError({
        code: 'AUTH_GOOGLE_OAUTH_REQUEST_INVALID',
        status: 400,
      });
    }
    return code;
  },
  exchangeGoogleOAuth(code: string, verifier: string) {
    return publicApiClient.post<GoogleOAuthExchange>(
      '/api/mobile/auth/oauth/google/exchange',
      { code, verifier },
      { auth: false },
    );
  },
  completeGoogleRegistration(input: GoogleRegistrationInput) {
    return publicApiClient.post<NativeSessionResponse>(
      '/api/mobile/auth/oauth/google/registrations',
      input,
      { auth: false },
    );
  },
  logout(refreshToken: string) {
    return publicApiClient.post<void>(
      '/api/mobile/auth/logout',
      { refreshToken },
      { auth: false },
    );
  },
  refresh(refreshToken: string) {
    return publicApiClient.post<NativeSessionResponse>(
      '/api/mobile/auth/refresh',
      { refreshToken },
      { auth: false },
    );
  },
  register(input: RegistrationInput) {
    return publicApiClient.post<NativeSessionResponse>('/api/mobile/auth/register', input, {
      auth: false,
    });
  },
  requestDevelopmentEmailVerification(email: string) {
    return publicApiClient.post<EmailVerification>(
      '/api/auth/email-verifications',
      { botChallengeToken: 'native-development', email },
      { auth: false },
    );
  },
  createEmailVerificationBridge(email: string) {
    return publicApiClient.post<NativeTurnstileBridge>(
      '/api/auth/mobile/email-verification-bridge',
      { email },
      { auth: false },
    );
  },
  redeemEmailVerificationBridge(
    email: string,
    bridge: Pick<NativeTurnstileBridge, 'bridgeId' | 'nativeProof'>,
  ) {
    return publicApiClient.post<EmailVerification>(
      '/api/auth/mobile/email-verification-bridge/redeem',
      { email, bridgeId: bridge.bridgeId, nativeProof: bridge.nativeProof },
      { auth: false },
    );
  },
  async requestEmailVerification(email: string) {
    if (__DEV__) return authApi.requestDevelopmentEmailVerification(email);
    if (!emailVerificationRedirectUri) {
      throw new ApiRequestError({
        code: 'AUTH_BOT_CHALLENGE_UNAVAILABLE',
        status: 503,
      });
    }

    return requestHostedEmailVerification(email, emailVerificationRedirectUri);
  },
};
