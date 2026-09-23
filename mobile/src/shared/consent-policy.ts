export const bundledConsentPolicy = {
  aiTransferVersion: '2026-07-27',
  effectiveDate: '2026-07-27',
  minimumAge: 14,
  privacyPolicyVersion: '2026-07-27',
} as const;

export function supportsBundledConsentPolicy(requirements: {
  aiTransferVersion: string;
  privacyPolicyVersion: string;
}) {
  return (
    requirements.aiTransferVersion === bundledConsentPolicy.aiTransferVersion &&
    requirements.privacyPolicyVersion === bundledConsentPolicy.privacyPolicyVersion
  );
}
