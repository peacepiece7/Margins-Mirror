export interface ConsentRequest {
  privacyPolicyAccepted: boolean;
  aiTransferAccepted: boolean;
  ageOver14Confirmed: boolean;
  privacyPolicyVersion: string;
  aiTransferVersion: string;
}

export interface PrivacyRequirementsResponse {
  privacyPolicyVersion: string;
  aiTransferVersion: string;
  effectiveDate: string;
  privacyUrl: string;
  historyUrl: string;
  minimumAge: number;
}

export interface PrivacyConsentStatusResponse {
  acceptedVersions: Record<string, string>;
  missingConsentTypes: string[];
  consentRequired: boolean;
}
