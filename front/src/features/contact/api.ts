import { getJson, postJson } from '@/lib/api-client';
import type {
  ContactAccountEmail,
  ContactInquiryRequest,
  ContactInquiryResponse,
} from '@/types/api/contact';

export const contactApi = {
  accountEmail(): Promise<ContactAccountEmail> {
    return getJson<ContactAccountEmail>('/api/account');
  },

  submit(request: ContactInquiryRequest): Promise<ContactInquiryResponse> {
    return postJson<ContactInquiryResponse>('/api/contact-inquiries', request);
  },
};
