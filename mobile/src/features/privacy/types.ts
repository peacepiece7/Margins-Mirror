export type ConsentRequest = {
  privacyPolicyAccepted: boolean;
  aiTransferAccepted: boolean;
  ageOver14Confirmed: boolean;
  privacyPolicyVersion: string;
  aiTransferVersion: string;
  preferredLocale?: "ko" | "en";
};
export type PrivacyRequirements = {
  privacyPolicyVersion: string;
  aiTransferVersion: string;
  effectiveDate: string;
  privacyUrl: string;
  historyUrl: string;
  minimumAge: number;
};
export type PrivacyConsentStatus = {
  acceptedVersions: Record<string, string>;
  missingConsentTypes: string[];
  consentRequired: boolean;
};
