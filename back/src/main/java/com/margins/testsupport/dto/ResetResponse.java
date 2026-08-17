package com.margins.testsupport.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ResetResponse {
    boolean reset;
    String mode;
}
