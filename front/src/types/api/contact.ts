export const contactCategories = [
  'SERVICE_USAGE',
  'ACCOUNT_LOGIN',
  'PRIVACY',
  'BUG_REPORT',
  'FEATURE_REQUEST',
  'OTHER',
] as const;

export type ContactCategory = (typeof contactCategories)[number];

export interface ContactInquiryRequest {
  email: string;
  category: ContactCategory;
  subject: string;
  message: string;
  botChallengeToken: string;
}

export interface ContactInquiryResponse {
  inquiryId: number;
  status: 'OPEN';
  createdAt: string;
}

export interface ContactAccountEmail {
  email: string;
}
