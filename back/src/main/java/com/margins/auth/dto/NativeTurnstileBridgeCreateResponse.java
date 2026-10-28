package com.margins.auth.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class NativeTurnstileBridgeCreateResponse {
    String bridgeId;
    String nativeProof;
    String hostedUrl;
    int expiresInSeconds;
}
