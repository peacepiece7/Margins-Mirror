package com.margins.common.dto;

import com.margins.common.error.ApiErrorCode;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ApiResponse<T> {
    boolean success;
    T data;
    ApiError error;

    public static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder()
            .success(true)
            .data(data)
            .build();
    }

    public static <T> ApiResponse<T> failed(ApiErrorCode code) {
        return failed(ApiError.of(code), null);
    }

    public static <T> ApiResponse<T> failed(ApiErrorCode code, T data) {
        return failed(ApiError.of(code), data);
    }

    public static <T> ApiResponse<T> failed(ApiError error) {
        return failed(error, null);
    }

    public static <T> ApiResponse<T> failed(ApiError error, T data) {
        return ApiResponse.<T>builder()
            .success(false)
            .data(data)
            .error(error)
            .build();
    }
}
