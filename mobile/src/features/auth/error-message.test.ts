import { ApiRequestError } from '@/shared/api/error';

import { authErrorMessage, authErrorMessageKey } from './error-message';

describe('authErrorMessageKey', () => {
  it('keeps the Google account-collision guidance stable and localizable', () => {
    expect(
      authErrorMessageKey(
        new ApiRequestError({ code: 'AUTH_GOOGLE_LINK_REQUIRED', status: 409 }),
      ),
    ).toBe('googleLinkRequired');
  });
});

describe('localized native auth guidance', () => {
  const translate = (key: string) => key;

  // BDD: AUTH-010
  it('uses retry-after and five-attempt verification guidance without backend messages', () => {
    expect(authErrorMessage(
      new ApiRequestError({
        code: 'AUTH_EMAIL_VERIFICATION_RATE_LIMITED',
        retryAfterSeconds: 42,
        status: 429,
      }),
      'ko',
      translate as never,
    )).toBe('인증 메일 요청이 너무 많습니다. 42초 후 다시 시도해 주세요.');
    expect(authErrorMessage(
      new ApiRequestError({ code: 'AUTH_EMAIL_VERIFICATION_INVALID', status: 400 }),
      'ko',
      translate as never,
    )).toContain('5회 실패');
    expect(authErrorMessage(
      new ApiRequestError({ code: 'COMMON_RATE_LIMITED', status: 429 }),
      'en',
      translate as never,
    )).toBe('genericError');
  });

  // BDD: ACCOUNT-004, ACCOUNT-005
  it('maps account recovery challenge failures to localized retry guidance', () => {
    expect(authErrorMessage(
      new ApiRequestError({ code: 'ACCOUNT_CHALLENGE_INVALID', status: 400 }),
      'en',
      translate as never,
    )).toContain('invalid or expired');
    expect(authErrorMessage(
      new ApiRequestError({
        code: 'ACCOUNT_CHALLENGE_RATE_LIMITED',
        retryAfterSeconds: 42,
        status: 429,
      }),
      'ko',
      translate as never,
    )).toContain('42초');
  });

  // BDD: AUTH-011
  it('explains the five failures and fifteen-minute login lock in both locales', () => {
    const error = new ApiRequestError({ code: 'AUTH_ACCOUNT_LOCKED', status: 401 });
    expect(authErrorMessage(error, 'en', translate as never)).toContain('Five');
    expect(authErrorMessage(error, 'en', translate as never)).toContain('15 minutes');
    expect(authErrorMessage(error, 'ko', translate as never)).toContain('5회');
    expect(authErrorMessage(error, 'ko', translate as never)).toContain('15분');
  });
});
