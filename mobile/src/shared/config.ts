import { Platform } from 'react-native';

const localApiOrigin = Platform.select({
  android: 'http://10.0.2.2:5813',
  default: 'http://localhost:5813',
});

export function normalizeApiBaseUrl(
  value = process.env.EXPO_PUBLIC_API_BASE_URL || localApiOrigin,
  isDevelopment = __DEV__,
) {
  if (!value) throw new Error('EXPO_PUBLIC_API_BASE_URL is required');
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('API base URL must use HTTP or HTTPS');
  }
  if (
    url.username ||
    url.password ||
    (url.pathname !== '' && url.pathname !== '/') ||
    url.search ||
    url.hash
  ) {
    throw new Error('API base URL must contain only a public origin');
  }
  if (!isDevelopment && url.protocol !== 'https:') {
    throw new Error('Production API base URL must use HTTPS');
  }
  return url.origin;
}

export const apiBaseUrl = normalizeApiBaseUrl();

export function normalizeOAuthRedirectUri(
  value = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI,
) {
  if (!value) return __DEV__ ? 'margins://oauth/google' : undefined;
  const url = new URL(value);
  if (!__DEV__ && url.protocol !== 'https:') {
    throw new Error('Production OAuth redirect URI must use HTTPS');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('OAuth redirect URI must not include credentials, query, or fragment');
  }
  return url.toString().replace(/\/$/, '');
}

export const oauthRedirectUri = normalizeOAuthRedirectUri();

export function normalizeEmailVerificationRedirectUri(
  value = process.env.EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URI,
) {
  if (!value) return __DEV__ ? 'margins://email-verification' : undefined;
  const url = new URL(value);
  if (!__DEV__ && url.protocol !== 'https:') {
    throw new Error('Production email verification redirect URI must use HTTPS');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'Email verification redirect URI must not include credentials, query, or fragment',
    );
  }
  return url.toString().replace(/\/$/, '');
}

export const emailVerificationRedirectUri = normalizeEmailVerificationRedirectUri();
