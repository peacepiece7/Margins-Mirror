import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiRequestError } from '@/shared/api/error';
import { messages } from '@/shared/i18n/messages';

import { RegistrationScreen } from './registration-screen';
import { authApi } from './api';

let mockLocale: 'en' | 'ko' = 'en';
const mockTranslate = (key: keyof typeof messages.en) => messages[mockLocale][key];

jest.mock('./api', () => ({
  authApi: {
    checkEmailAvailability: jest.fn(),
    confirmEmailVerification: jest.fn(),
    createRegistrationIntent: jest.fn(),
    getPrivacyRequirements: jest.fn(),
    requestEmailVerification: jest.fn(),
  },
}));
jest.mock('./session-provider', () => ({
  useAuthSession: () => ({
    googleRegistrationPending: false,
    register: jest.fn(),
    registerWithGoogle: jest.fn(),
  }),
}));
jest.mock('@/shared/i18n/i18n-provider', () => {
  return {
    useI18n: () => ({
      locale: mockLocale,
      t: mockTranslate,
    }),
  };
});

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

const requirements = {
  aiTransferVersion: '2026-07-27',
  effectiveDate: '2026-07-27',
  historyUrl: '/privacy/history',
  minimumAge: 14,
  privacyPolicyVersion: '2026-07-27',
  privacyUrl: '/privacy',
};

const navigationProps = {
  onBack: jest.fn(),
  onOpenPrivacy: jest.fn(),
  onOpenTerms: jest.fn(),
};

describe('RegistrationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocale = 'en';
  });

  it('clears a requirements error after retry succeeds', async () => {
    mockAuthApi.getPrivacyRequirements
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(requirements);
    const screen = await render(<RegistrationScreen {...navigationProps} />);

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Create your reading account')).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText('Something went wrong. Please try again.')).toBeNull(),
    );
  });

  it('keeps email editable until verification and resets availability when it changes', async () => {
    mockAuthApi.getPrivacyRequirements.mockResolvedValue(requirements);
    mockAuthApi.checkEmailAvailability.mockResolvedValue({
      available: true,
      email: 'reader@example.com',
    });
    const screen = await render(<RegistrationScreen {...navigationProps} />);
    await screen.findByText('Create your reading account');

    const email = screen.getByLabelText('Email');
    await fireEvent.changeText(email, 'reader@example.com');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Check email availability' }),
    );
    expect(await screen.findByRole('button', { name: 'Send verification code' })).toBeTruthy();
    expect(screen.getByLabelText('Email').props.editable).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'other@example.com');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Check email availability' }),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: 'Send verification code' })).toBeNull();
  });

  // BDD: AUTH-022 then-7
  // BDD: TERM-021
  it('keeps completed email verification controls visible and disabled', async () => {
    mockAuthApi.getPrivacyRequirements.mockResolvedValue(requirements);
    mockAuthApi.checkEmailAvailability.mockResolvedValue({
      available: true,
      email: 'reader@example.com',
    });
    mockAuthApi.requestEmailVerification.mockResolvedValue({
      email: 'reader@example.com',
      expiresInSeconds: 300,
      resendAfterSeconds: 0,
    });
    mockAuthApi.confirmEmailVerification.mockResolvedValue({
      email: 'reader@example.com',
      verified: true,
    });
    const screen = await render(<RegistrationScreen {...navigationProps} />);
    await screen.findByText('Create your reading account');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'reader@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Check email availability' }));
    await fireEvent.press(await screen.findByTestId('registration-email-send'));
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
    await fireEvent.press(screen.getByTestId('registration-email-confirm'));

    expect(await screen.findByText('Required consent')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Service Terms' })).toBeTruthy();
    expect(screen.getByLabelText('Email').props.editable).toBe(false);
    expect(screen.getByLabelText('Verification code').props.editable).toBe(false);
    expect(screen.getByTestId('registration-email-send').props.accessibilityState)
      .toMatchObject({ disabled: true });
    expect(screen.getByTestId('registration-email-confirm').props.accessibilityState)
      .toMatchObject({ disabled: true });
  });

  it('blocks registration when required policy text is newer than the bundled policy', async () => {
    mockAuthApi.getPrivacyRequirements.mockResolvedValue({
      ...requirements,
      aiTransferVersion: '2026-09-01',
      privacyPolicyVersion: '2026-09-01',
    });
    const screen = await render(<RegistrationScreen {...navigationProps} />);

    expect(
      await screen.findByText(
        'A newer consent policy is required. Update Margins before creating an account.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Create your reading account')).toBeNull();
  });

  // BDD: AUTH-010
  it('places authoritative rate-limit and five-attempt errors on their fields', async () => {
    mockAuthApi.getPrivacyRequirements.mockResolvedValue(requirements);
    mockAuthApi.checkEmailAvailability.mockResolvedValue({
      available: true,
      email: 'reader@example.com',
    });
    mockAuthApi.requestEmailVerification.mockResolvedValue({
      email: 'reader@example.com',
      expiresInSeconds: 300,
      resendAfterSeconds: 0,
    });
    mockAuthApi.confirmEmailVerification.mockRejectedValue(
      new ApiRequestError({ code: 'AUTH_EMAIL_VERIFICATION_INVALID', status: 400 }),
    );
    const screen = await render(<RegistrationScreen {...navigationProps} />);
    await screen.findByText('Create your reading account');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'reader@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Check email availability' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Send verification code' }));
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await fireEvent.press(screen.getByTestId('registration-email-confirm'));
      await waitFor(() =>
        expect(mockAuthApi.confirmEmailVerification).toHaveBeenCalledTimes(attempt + 1),
      );
    }

    expect(screen.getByText(/locked after five failed attempts/)).toBeTruthy();
    expect(screen.getByTestId('registration-email-confirm').props.accessibilityState)
      .toMatchObject({ disabled: true });
  });

  // BDD: AUTH-010
  it('honors Retry-After and localizes a 429 response', async () => {
    mockLocale = 'ko';
    mockAuthApi.getPrivacyRequirements.mockResolvedValue(requirements);
    mockAuthApi.checkEmailAvailability.mockResolvedValue({
      available: true,
      email: 'reader@example.com',
    });
    mockAuthApi.requestEmailVerification.mockRejectedValue(
      new ApiRequestError({
        code: 'AUTH_EMAIL_VERIFICATION_RATE_LIMITED',
        retryAfterSeconds: 37,
        status: 429,
      }),
    );
    const screen = await render(<RegistrationScreen {...navigationProps} />);
    await screen.findByText('독서 계정 만들기');
    await fireEvent.changeText(screen.getByLabelText('이메일'), 'reader@example.com');
    await fireEvent.press(screen.getByRole('button', { name: '이메일 중복 확인' }));
    await fireEvent.press(await screen.findByRole('button', { name: '인증번호 보내기' }));

    await waitFor(() => expect(screen.getAllByText(/37초 후/).length).toBeGreaterThan(0));
    expect(screen.getByTestId('registration-email-send').props.accessibilityState)
      .toMatchObject({ disabled: true });
  });

  // BDD: PRIVACY-010, AUTH-025
  it('keeps the whole registration and consent surface in Korean', async () => {
    mockLocale = 'ko';
    mockAuthApi.getPrivacyRequirements.mockResolvedValue(requirements);
    const screen = await render(<RegistrationScreen {...navigationProps} />);

    expect(await screen.findByText('독서 계정 만들기')).toBeTruthy();
    expect(screen.getByLabelText('사용자 이름')).toBeTruthy();
    expect(screen.getByLabelText('표시 이름')).toBeTruthy();
    expect(screen.queryByText('Create your reading account')).toBeNull();
  });
});
