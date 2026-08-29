export interface LoginResponse {
  userId: number;
  username: string;
  displayName: string;
  authMode: string;
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  consentRequired?: boolean;
  membershipTier?: 'FREE' | 'PREMIUM';
  preferredLocale?: 'ko' | 'en';
}

export interface RegisterRequest {
  username: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  email: string;
  emailVerificationCode: string;
  preferredLocale: 'ko' | 'en';
}

export interface EmailAvailabilityResponse {
  email: string;
  available: boolean;
}

export interface EmailVerificationResponse {
  email: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  devVerificationCode?: string;
}

export interface EmailVerificationConfirmResponse {
  email: string;
  verified: boolean;
}
