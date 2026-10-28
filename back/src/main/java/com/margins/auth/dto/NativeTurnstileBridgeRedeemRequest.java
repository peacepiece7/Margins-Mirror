package com.margins.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class NativeTurnstileBridgeRedeemRequest {
    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Size(max = 64)
    private String bridgeId;

    @NotBlank
    @Size(max = 128)
    private String nativeProof;
}
