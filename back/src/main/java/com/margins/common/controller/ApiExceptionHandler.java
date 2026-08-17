package com.margins.common.controller;

import com.margins.common.dto.ApiError;
import com.margins.common.dto.ApiFieldError;
import com.margins.common.dto.ApiResponse;
import com.margins.auth.service.MailDeliveryException;
import com.margins.auth.service.EmailVerificationRateLimitException;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.server.ResponseStatusException;

/**
 * 전역 API 예외를 공통 응답 형식으로 변환한다.
 * 검증 실패와 상태 예외가 클라이언트에 일관된 JSON으로 내려가게 한다.
 */
@RestControllerAdvice
@Slf4j
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException exception) {
        List<ApiFieldError> fields = exception.getBindingResult().getFieldErrors().stream()
            .map(this::toFieldError)
            .toList();

        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.failed(ApiError.withFields(ApiErrorCode.COMMON_VALIDATION_FAILED, fields)));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleApi(ApiException exception) {
        ApiError error = exception.getPublicMessage() == null
            ? ApiError.of(exception.getCode())
            : ApiError.of(exception.getCode(), exception.getPublicMessage());
        log.warn("API request failed requestId={} code={}", error.getRequestId(), exception.getCode());
        return ResponseEntity
            .status(exception.getCode().status())
            .body(ApiResponse.failed(error));
    }

    @ExceptionHandler(EmailVerificationRateLimitException.class)
    public ResponseEntity<ApiResponse<Void>> handleEmailVerificationRateLimit(
        EmailVerificationRateLimitException exception
    ) {
        return ResponseEntity
            .status(exception.getCode().status())
            .header("Retry-After", Long.toString(exception.getRetryAfterSeconds()))
            .body(ApiResponse.failed(exception.getCode()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handleResponseStatus(ResponseStatusException exception) {
        ApiErrorCode code = ApiErrorCode.fromStatus(exception.getStatusCode().value());

        return ResponseEntity
            .status(exception.getStatusCode())
            .body(ApiResponse.failed(code));
    }

    @ExceptionHandler(MailDeliveryException.class)
    public ResponseEntity<ApiResponse<Void>> handleMailDelivery(MailDeliveryException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(ApiResponse.failed(ApiErrorCode.AUTH_VERIFICATION_EMAIL_DELIVERY_FAILED));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResource(NoResourceFoundException exception) {
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(ApiResponse.failed(ApiErrorCode.COMMON_NOT_FOUND));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception exception) {
        ApiError error = ApiError.of(ApiErrorCode.COMMON_INTERNAL_ERROR);
        log.error("Unhandled API error requestId={}", error.getRequestId(), exception);
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse.failed(error));
    }

    private ApiFieldError toFieldError(FieldError error) {
        return ApiFieldError.builder()
            .field(error.getField())
            .code(validationCode(error.getCode()))
            .build();
    }

    private ApiErrorCode validationCode(String constraint) {
        if (constraint == null) return ApiErrorCode.VALIDATION_INVALID;
        return switch (constraint) {
            case "NotBlank", "NotEmpty", "NotNull" -> ApiErrorCode.VALIDATION_REQUIRED;
            case "Email", "Pattern" -> ApiErrorCode.VALIDATION_INVALID_FORMAT;
            case "Min", "Max", "DecimalMin", "DecimalMax", "Positive", "PositiveOrZero" ->
                ApiErrorCode.VALIDATION_OUT_OF_RANGE;
            case "Size" -> ApiErrorCode.VALIDATION_SIZE;
            default -> ApiErrorCode.VALIDATION_INVALID;
        };
    }
}
