package com.margins.common.dto;

import com.margins.common.error.ApiErrorCode;
import lombok.Builder;
import lombok.Value;

/** Structured controller-validation failure without localized server copy. */
@Value
@Builder
public class ApiFieldError {
    String field;
    ApiErrorCode code;
}
