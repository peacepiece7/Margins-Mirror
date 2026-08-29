import type { ApiErrorCode } from '@/types/api/api-response';

import type { TranslationKey } from './i18n';
import { ApiRequestError } from './api-client';

export const API_ERROR_TRANSLATIONS = {
  COMMON_VALIDATION_FAILED: 'requestInvalid',
  COMMON_BAD_REQUEST: 'requestInvalid',
  COMMON_UNAUTHORIZED: 'requestUnauthorized',
  COMMON_FORBIDDEN: 'requestForbidden',
  COMMON_NOT_FOUND: 'requestNotFound',
  COMMON_CONFLICT: 'requestConflict',
  COMMON_PRECONDITION_REQUIRED: 'requestInvalid',
  COMMON_RATE_LIMITED: 'requestRateLimited',
  COMMON_INTERNAL_ERROR: 'requestFailed',
  COMMON_UPSTREAM_ERROR: 'requestFailed',
  COMMON_SERVICE_UNAVAILABLE: 'requestServiceUnavailable',
  VALIDATION_REQUIRED: 'requestInvalid',
  VALIDATION_INVALID: 'requestInvalid',
  VALIDATION_INVALID_FORMAT: 'requestInvalid',
  VALIDATION_OUT_OF_RANGE: 'requestInvalid',
  VALIDATION_SIZE: 'requestInvalid',
  AUTH_INVALID_CREDENTIALS: 'loginInvalidCredentials',
  AUTH_ACCOUNT_LOCKED: 'loginAccountLocked',
  AUTH_PASSWORD_CONFIRMATION_INVALID: 'passwordConfirmationInvalid',
  AUTH_USERNAME_ALREADY_REGISTERED: 'usernameInUse',
  AUTH_EMAIL_ALREADY_REGISTERED: 'emailInUse',
  AUTH_REFRESH_TOKEN_INVALID: 'requestUnauthorized',
  AUTH_ACCOUNT_INACTIVE: 'requestUnauthorized',
  AUTH_LINKED_USER_NOT_FOUND: 'loginFailed',
  AUTH_GOOGLE_REGISTRATION_REQUIRED: 'registerFailed',
  AUTH_GOOGLE_ACCOUNT_ALREADY_EXISTS: 'googleAccountAlreadyExists',
  AUTH_GOOGLE_LINK_REQUIRED: 'googleAccountAlreadyExists',
  AUTH_GOOGLE_ALREADY_LINKED: 'googleAccountAlreadyLinked',
  AUTH_GOOGLE_LINKED_TO_ANOTHER_USER: 'googleAccountLinkedElsewhere',
  AUTH_GOOGLE_LINKING_UNAVAILABLE: 'googleAccountLinkingUnavailable',
  AUTH_GOOGLE_NOT_CONFIGURED: 'googleLoginUnavailable',
  AUTH_GOOGLE_TOKEN_EXCHANGE_FAILED: 'loginFailed',
  AUTH_GOOGLE_ID_TOKEN_INVALID: 'loginFailed',
  AUTH_GOOGLE_OAUTH_CANCELLED: 'googleLoginCancelled',
  AUTH_GOOGLE_OAUTH_STATE_INVALID: 'googleLoginRequestInvalid',
  AUTH_GOOGLE_OAUTH_REQUEST_INVALID: 'googleLoginRequestInvalid',
  AUTH_EMAIL_REQUIRED: 'emailRequired',
  AUTH_EMAIL_VERIFICATION_INVALID: 'emailVerificationInvalid',
  AUTH_BOT_CHALLENGE_INVALID: 'botChallengeInvalid',
  AUTH_BOT_CHALLENGE_UNAVAILABLE: 'botChallengeUnavailable',
  AUTH_EMAIL_VERIFICATION_RATE_LIMITED: 'emailVerificationRateLimited',
  AUTH_VERIFICATION_EMAIL_DELIVERY_FAILED: 'emailVerificationFailed',
  ACCOUNT_PASSWORD_CHANGE_UNAVAILABLE: 'accountErrorPassword',
  ACCOUNT_CURRENT_PASSWORD_INVALID: 'accountCurrentPasswordInvalid',
  ACCOUNT_PASSWORD_CONFIRMATION_INVALID: 'passwordConfirmationInvalid',
  ACCOUNT_RECOVERY_INVALID: 'recoveryError',
  ACCOUNT_INACTIVE: 'requestUnauthorized',
  ACCOUNT_CHALLENGE_RATE_LIMITED: 'requestRateLimited',
  ACCOUNT_CHALLENGE_INVALID: 'accountChallengeInvalid',
  PRIVACY_CONSENT_INVALID: 'consentSaveFailed',
  PRIVACY_REGISTRATION_INTENT_INVALID: 'registerFailed',
  PRIVACY_GOOGLE_REGISTRATION_INVALID: 'registerFailed',
  PRIVACY_CONSENT_REQUIRED: 'consentSaveFailed',
  CONTACT_INQUIRY_UNAVAILABLE: 'contactUnavailable',
  CONTACT_INQUIRY_BOT_CHALLENGE_INVALID: 'contactBotChallengeInvalid',
  CONTACT_INQUIRY_BOT_CHALLENGE_UNAVAILABLE: 'contactBotChallengeUnavailable',
  CONTACT_INQUIRY_DELIVERY_FAILED: 'contactDeliveryFailed',
  MEMBERSHIP_PREMIUM_REQUIRED: 'premiumRequired',
  BOOK_ALREADY_EXISTS: 'bookAlreadyExists',
  SESSION_LAST_WINDOW_REQUIRED: 'workbenchLastWindowRequired',
  SESSION_ANSWERED_QUESTION_DELETE_CONFLICT: 'questionAnsweredDeleteConflict',
  SESSION_QUESTION_ANSWER_ROUTE_REQUIRED: 'questionAnswerRouteRequired',
  SESSION_QUESTION_ANSWER_TYPE_INVALID: 'questionAnswerRouteRequired',
  STREAM_MESSAGE_FAILED: 'streamFailed',
} satisfies Record<ApiErrorCode, TranslationKey>;

type Translate = (key: TranslationKey) => string;

export function apiErrorTranslationKey(
  code: string | undefined,
  fallback: TranslationKey = 'requestFailed',
): TranslationKey {
  return (
    code && code in API_ERROR_TRANSLATIONS ? API_ERROR_TRANSLATIONS[code as ApiErrorCode] : fallback
  ) as TranslationKey;
}

export function apiErrorMessage(
  error: unknown,
  t: Translate,
  fallback: TranslationKey = 'requestFailed',
): string {
  return t(
    apiErrorTranslationKey(error instanceof ApiRequestError ? error.code : undefined, fallback),
  );
}
