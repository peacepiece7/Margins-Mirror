package com.margins.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class NativeTurnstileBridgeCompleteRequest {
    @NotBlank
    @Size(max = 2048)
    private String token;
}
