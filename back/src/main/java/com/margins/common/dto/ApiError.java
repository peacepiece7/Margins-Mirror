package com.margins.common.dto;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.support.RequestCorrelationContext;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import lombok.Value;

/** Public failure metadata shared by JSON APIs and authentication filters. */
@Value
@Builder
public class ApiError {
    ApiErrorCode code;
    String message;
    @Builder.Default
    List<ApiFieldError> fields = List.of();
    String requestId;

    public static ApiError of(ApiErrorCode code) {
        return withFields(code, List.of());
    }

    public static ApiError of(ApiErrorCode code, String message) {
        return ApiError.builder()
            .code(code)
            .message(message)
            .fields(List.of())
            .requestId(RequestCorrelationContext.current().orElseGet(() -> UUID.randomUUID().toString()))
            .build();
    }

    public static ApiError withFields(ApiErrorCode code, List<ApiFieldError> fields) {
        return ApiError.builder()
            .code(code)
            .fields(fields == null ? List.of() : List.copyOf(fields))
            .requestId(RequestCorrelationContext.current().orElseGet(() -> UUID.randomUUID().toString()))
            .build();
    }
}
