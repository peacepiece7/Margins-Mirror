package com.margins.ai.observability;

import java.net.URI;
import java.util.regex.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "margins.ai.langfuse")
public class LangfuseProperties {
    private static final Pattern ENVIRONMENT = Pattern.compile("^(?!langfuse)[a-z0-9-_]{1,40}$");

    private boolean enabled = true;
    private String publicKey;
    private String secretKey;
    private String baseUrl = "https://jp.cloud.langfuse.com";
    private String environment = "local";
    private String release = "local";
    private double sampleRate = 1.0;
    private int exportTimeoutSeconds = 5;

    public boolean configured() {
        return enabled && hasText(publicKey) && hasText(secretKey) && hasText(baseUrl);
    }

    public URI tracesEndpoint() {
        URI base = URI.create(normalizedBaseUrl());
        if (!"https".equalsIgnoreCase(base.getScheme())
            || base.getHost() == null
            || base.getUserInfo() != null
            || base.getQuery() != null
            || base.getFragment() != null) {
            throw new IllegalArgumentException("LANGFUSE_BASE_URL must be an HTTPS origin");
        }
        return URI.create(normalizedBaseUrl() + "/api/public/otel/v1/traces");
    }

    public void validate() {
        if (!enabled) {
            return;
        }
        boolean anyCredential = hasText(publicKey) || hasText(secretKey);
        if (anyCredential && !(hasText(publicKey) && hasText(secretKey))) {
            throw new IllegalArgumentException(
                "LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY must be configured together"
            );
        }
        if (anyCredential && !hasText(baseUrl)) {
            throw new IllegalArgumentException(
                "LANGFUSE_BASE_URL is required when credentials are configured"
            );
        }
        if (!configured()) {
            return;
        }
        tracesEndpoint();
        if (sampleRate < 0 || sampleRate > 1) {
            throw new IllegalArgumentException("LANGFUSE_SAMPLE_RATE must be between 0 and 1");
        }
        if (!hasText(environment) || !ENVIRONMENT.matcher(environment).matches()) {
            throw new IllegalArgumentException("LANGFUSE_TRACING_ENVIRONMENT is invalid");
        }
        if (exportTimeoutSeconds < 1 || exportTimeoutSeconds > 60) {
            throw new IllegalArgumentException("LANGFUSE_EXPORT_TIMEOUT_SECONDS must be between 1 and 60");
        }
    }

    private String normalizedBaseUrl() {
        String normalized = baseUrl == null ? "" : baseUrl.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getPublicKey() {
        return publicKey;
    }

    public void setPublicKey(String publicKey) {
        this.publicKey = publicKey;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getEnvironment() {
        return environment;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    public String getRelease() {
        return release;
    }

    public void setRelease(String release) {
        this.release = release;
    }

    public double getSampleRate() {
        return sampleRate;
    }

    public void setSampleRate(double sampleRate) {
        this.sampleRate = sampleRate;
    }

    public int getExportTimeoutSeconds() {
        return exportTimeoutSeconds;
    }

    public void setExportTimeoutSeconds(int exportTimeoutSeconds) {
        this.exportTimeoutSeconds = exportTimeoutSeconds;
    }
}
