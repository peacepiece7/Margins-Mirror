package com.margins.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class NativeTurnstileBridgeCreateRequest {
    @NotBlank
    @Email
    private String email;
}
