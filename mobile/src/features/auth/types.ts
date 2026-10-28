import type { Locale } from '@/shared/i18n/messages';

export type MembershipTier = 'FREE' | 'PREMIUM';

export type AuthSession = {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  authMode: string;
  consentRequired?: boolean;
  displayName: string;
  membershipTier?: MembershipTier;
  preferredLocale?: Locale;
  userId: number;
  username: string;
};

export type NativeSessionResponse = AuthSession & {
  refreshToken: string;
  refreshTokenExpiresInSeconds: number;
};

export type LoginInput = {
  password: string;
  username: string;
};

export type RegistrationInput = {
  confirmPassword: string;
  displayName: string;
  email: string;
  emailVerificationCode: string;
  password: string;
  preferredLocale: Locale;
  registrationIntentToken: string;
  username: string;
};

export type ConsentInput = {
  ageOver14Confirmed: boolean;
  aiTransferAccepted: boolean;
  aiTransferVersion: string;
  preferredLocale?: Locale;
  privacyPolicyAccepted: boolean;
  privacyPolicyVersion: string;
};

export type RegistrationIntent = {
  registrationIntentToken: string;
};

export type EmailAvailability = {
  available: boolean;
  email: string;
};

export type EmailVerification = {
  devVerificationCode?: string;
  email: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

export type EmailVerificationConfirmation = {
  email: string;
  verified: boolean;
};

export type NativeTurnstileBridge = {
  bridgeId: string;
  expiresInSeconds: number;
  hostedUrl: string;
  nativeProof: string;
};

export type PrivacyRequirements = {
  aiTransferVersion: string;
  effectiveDate: string;
  historyUrl: string;
  minimumAge: number;
  privacyPolicyVersion: string;
  privacyUrl: string;
};

export type GoogleOAuthExchange =
  | { pendingRegistrationToken: string; status: 'REGISTRATION_REQUIRED' }
  | { session: NativeSessionResponse; status: 'SESSION' };

export type GoogleOAuthVerifier = {
  challenge: string;
  verifier: string;
};

export type GoogleRegistrationInput = ConsentInput & {
  pendingRegistrationToken: string;
};
