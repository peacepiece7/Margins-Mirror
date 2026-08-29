export type AuthFormValues = {
  username: string;
  displayName: string;
  email: string;
  emailVerificationCode: string;
  preferredLocale: 'ko' | 'en';
  password: string;
  confirmPassword: string;
  privacyPolicyAccepted: boolean;
  aiTransferAccepted: boolean;
  ageOver14Confirmed: boolean;
};

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
