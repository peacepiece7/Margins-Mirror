package com.margins.common.error;

import lombok.Getter;
import org.springframework.web.server.ResponseStatusException;

/**
 * Typed domain failure whose public contract is an {@link ApiErrorCode}.
 * The optional internal reason supports server-side diagnostics and is never serialized.
 */
@Getter
public class ApiException extends ResponseStatusException {
    private final ApiErrorCode code;
    private final String publicMessage;

    public ApiException(ApiErrorCode code) {
        this(code, code.name(), (String) null);
    }

    public ApiException(ApiErrorCode code, String internalReason) {
        this(code, internalReason, (String) null);
    }

    public ApiException(ApiErrorCode code, String internalReason, String publicMessage) {
        super(code.status(), internalReason);
        this.code = code;
        this.publicMessage = publicMessage;
    }

    public ApiException(ApiErrorCode code, String internalReason, Throwable cause) {
        super(code.status(), internalReason, cause);
        this.code = code;
        this.publicMessage = null;
    }
}
