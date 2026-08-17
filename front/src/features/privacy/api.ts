import { authJson, getJson, postJson } from '@/lib/api-client';
import type {
  ConsentRequest,
  PrivacyConsentStatusResponse,
  PrivacyRequirementsResponse,
} from '@/types/api/privacy';
import type { LoginResponse } from '@/types/api/auth';

export const privacyApi = {
  requirements(): Promise<PrivacyRequirementsResponse> {
    return authJson<PrivacyRequirementsResponse>({
      url: '/api/privacy/requirements',
      method: 'GET',
    });
  },
  status(): Promise<PrivacyConsentStatusResponse> {
    return getJson<PrivacyConsentStatusResponse>('/api/privacy/consents');
  },
  grant(request: ConsentRequest): Promise<PrivacyConsentStatusResponse> {
    return postJson<PrivacyConsentStatusResponse>('/api/privacy/consents', request);
  },
  completeGoogleRegistration(request: ConsentRequest): Promise<LoginResponse> {
    return authJson<LoginResponse>({
      url: '/api/auth/oauth/google/registrations',
      method: 'POST',
      data: request,
    });
  },
};
