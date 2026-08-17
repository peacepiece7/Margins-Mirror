import { authJson, rotateRefreshToken } from '@/lib/api-client';
import type {
  EmailAvailabilityResponse,
  EmailVerificationConfirmResponse,
  EmailVerificationResponse,
  LoginResponse,
  RegisterRequest,
} from '@/types/api/auth';
import type { ConsentRequest } from '@/types/api/privacy';

export const authApi = {
  login(username: string, password: string): Promise<LoginResponse> {
    return authJson<LoginResponse>({
      url: '/api/auth/login',
      method: 'POST',
      data: { username, password },
    });
  },

  register(request: RegisterRequest): Promise<LoginResponse> {
    return authJson<LoginResponse>({
      url: '/api/auth/register',
      method: 'POST',
      data: request,
    });
  },

  createRegistrationIntent(request: ConsentRequest): Promise<void> {
    return authJson<void>({
      url: '/api/auth/registration-intents',
      method: 'POST',
      data: request,
    });
  },

  requestEmailVerification(
    email: string,
    botChallengeToken: string,
  ): Promise<EmailVerificationResponse> {
    return authJson<EmailVerificationResponse>({
      url: '/api/auth/email-verifications',
      method: 'POST',
      data: { email, botChallengeToken },
    });
  },

  confirmEmailVerification(email: string, code: string): Promise<EmailVerificationConfirmResponse> {
    return authJson<EmailVerificationConfirmResponse>({
      url: '/api/auth/email-verifications/confirm',
      method: 'POST',
      data: { email, code },
    });
  },

  checkEmailAvailability(email: string): Promise<EmailAvailabilityResponse> {
    const params = new URLSearchParams({ email });
    return authJson<EmailAvailabilityResponse>({
      url: `/api/auth/email-availability?${params.toString()}`,
      method: 'GET',
    });
  },

  refresh(): Promise<LoginResponse> {
    return rotateRefreshToken();
  },

  logout(): Promise<void> {
    return authJson<void>({ url: '/api/auth/logout', method: 'POST', data: {} });
  },

  googleOAuthStartUrl(): string {
    return '/api/auth/oauth/google/start';
  },
};
