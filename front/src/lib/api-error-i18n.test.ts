import { describe, expect, it } from 'vitest';

import { apiErrorCodes } from '@/types/api/api-response';

import { ApiRequestError } from './api-client';
import { API_ERROR_TRANSLATIONS, apiErrorMessage, apiErrorTranslationKey } from './api-error-i18n';
import { translationCatalog } from './i18n';

describe('API error i18n', () => {
  it('maps every public backend code to an English and Korean translation', () => {
    for (const code of apiErrorCodes) {
      const key = API_ERROR_TRANSLATIONS[code];
      expect(translationCatalog.en[key]).toBeTruthy();
      expect(translationCatalog.ko[key]).toBeTruthy();
    }
  });

  it('localizes the Google link conflict in both locales', () => {
    const error = new ApiRequestError('AUTH_GOOGLE_LINK_REQUIRED', 409);

    expect(apiErrorMessage(error, (key) => translationCatalog.en[key])).toBe(
      'An account with this email already exists. Please sign in with your existing account.',
    );
    expect(apiErrorMessage(error, (key) => translationCatalog.ko[key])).toBe(
      '이미 사용 중인 이메일입니다. 기존 계정으로 로그인해 주세요.',
    );
  });

  it('uses the localized generic fallback for an unknown server code', () => {
    expect(apiErrorTranslationKey('FUTURE_UNKNOWN_CODE')).toBe('requestFailed');
    expect(
      apiErrorMessage(
        new ApiRequestError('FUTURE_UNKNOWN_CODE', 500),
        (key) => translationCatalog.ko[key],
      ),
    ).toBe('요청을 처리하지 못했습니다. 다시 시도해 주세요.');
  });

  it('localizes normalized Google OAuth callback failures', () => {
    expect(
      apiErrorMessage(
        new ApiRequestError('AUTH_GOOGLE_OAUTH_CANCELLED', 400),
        (key) => translationCatalog.ko[key],
      ),
    ).toBe('Google 로그인이 취소되었습니다.');
    expect(
      apiErrorMessage(
        new ApiRequestError('AUTH_GOOGLE_OAUTH_STATE_INVALID', 400),
        (key) => translationCatalog.en[key],
      ),
    ).toBe('The Google sign-in request is invalid or has expired. Start again.');
  });
});
