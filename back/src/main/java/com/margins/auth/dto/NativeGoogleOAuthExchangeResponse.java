package com.margins.auth.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class NativeGoogleOAuthExchangeResponse {
    String status;
    NativeSessionResponse session;
    String pendingRegistrationToken;
}
