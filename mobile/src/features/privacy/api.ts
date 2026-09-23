import type { ApiClient } from "@/shared/api/client";

import type {
  ConsentRequest,
  PrivacyConsentStatus,
  PrivacyRequirements,
} from "./types";

export function createPrivacyApi(client: ApiClient) {
  return {
    requirements: () =>
      client.get<PrivacyRequirements>("/api/privacy/requirements", {
        auth: false,
      }),
    status: () => client.get<PrivacyConsentStatus>("/api/privacy/consents"),
    grant: (request: ConsentRequest) =>
      client.post<PrivacyConsentStatus>("/api/privacy/consents", request),
  };
}
