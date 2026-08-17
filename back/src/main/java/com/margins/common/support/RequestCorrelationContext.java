package com.margins.common.support;

import java.util.Optional;
import java.util.UUID;
import org.slf4j.MDC;

/** Keeps one opaque request identifier available to API errors, logs, and AI events. */
public final class RequestCorrelationContext {
    public static final String MDC_KEY = "requestId";

    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    private RequestCorrelationContext() {
    }

    public static String bindNew() {
        String requestId = UUID.randomUUID().toString();
        bind(requestId);
        return requestId;
    }

    public static void bind(String requestId) {
        if (requestId == null || requestId.isBlank()) {
            throw new IllegalArgumentException("requestId must not be blank");
        }
        CURRENT.set(requestId);
        MDC.put(MDC_KEY, requestId);
    }

    public static Optional<String> current() {
        return Optional.ofNullable(CURRENT.get());
    }

    public static void clear() {
        CURRENT.remove();
        MDC.remove(MDC_KEY);
    }
}
