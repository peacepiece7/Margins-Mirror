import { ApiRequestError } from '@/shared/api/error';
import type { Locale, MessageKey } from '@/shared/i18n/messages';

import { authCopy } from './copy';

const errorMessages: Record<string, MessageKey> = {
  AUTH_ACCOUNT_LOCKED: 'accountLocked',
  AUTH_GOOGLE_NOT_CONFIGURED: 'genericError',
  AUTH_GOOGLE_OAUTH_CANCELLED: 'genericError',
  AUTH_GOOGLE_LINK_REQUIRED: 'googleLinkRequired',
  AUTH_INVALID_CREDENTIALS: 'invalidCredentials',
  COMMON_NETWORK_ERROR: 'networkError',
  COMMON_REQUEST_ABORTED: 'networkError',
};

export function authErrorMessageKey(error: unknown): MessageKey {
  const code = error instanceof ApiRequestError
    ? error.code
    : error instanceof Error
      ? error.message
      : '';
  return errorMessages[code] ?? 'genericError';
}

export function authErrorMessage(
  error: unknown,
  locale: Locale,
  translate: (key: MessageKey) => string,
) {
  if (error instanceof ApiRequestError) {
    if (error.code === 'AUTH_ACCOUNT_LOCKED') {
      return authCopy(locale, 'accountLocked');
    }
    if (error.code === 'AUTH_EMAIL_VERIFICATION_INVALID') {
      return authCopy(locale, 'invalidOrExpiredCode');
    }
    if (error.code === 'ACCOUNT_CHALLENGE_INVALID') {
      return authCopy(locale, 'invalidOrExpiredCode');
    }
    if (error.code === 'AUTH_EMAIL_VERIFICATION_RATE_LIMITED') {
      return authCopy(locale, 'emailRateLimited', {
        seconds: error.retryAfterSeconds ?? 60,
      });
    }
    if (error.code === 'ACCOUNT_CHALLENGE_RATE_LIMITED') {
      return authCopy(locale, 'emailRateLimited', {
        seconds: error.retryAfterSeconds ?? 60,
      });
    }
  }
  return translate(authErrorMessageKey(error));
}
