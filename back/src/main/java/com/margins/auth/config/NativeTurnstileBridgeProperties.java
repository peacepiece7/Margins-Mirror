package com.margins.auth.config;

import java.net.URI;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@Data
@ConfigurationProperties(prefix = "margins.auth.native-turnstile-bridge")
public class NativeTurnstileBridgeProperties {
    private boolean enabled;
    private String siteKey = "";
    private String hostedBaseUrl = "";
    private String returnUri = "";
    private int ttlSeconds = 300;
    private int capacity = 2048;
    private int createLimitPerMinute = 10;
    private int callerCapacity = 2048;

    public boolean isConfigured() {
        return enabled
            && StringUtils.hasText(siteKey)
            && siteKey.trim().matches("[A-Za-z0-9._-]+")
            && validFixedUri(hostedBaseUrl, true)
            && validFixedUri(returnUri, true)
            && ttlSeconds > 0
            && ttlSeconds <= 300
            && capacity > 0
            && createLimitPerMinute > 0
            && callerCapacity > 0;
    }

    private boolean validFixedUri(String value, boolean requireHttps) {
        if (!StringUtils.hasText(value)) return false;
        try {
            URI uri = URI.create(value.trim());
            return uri.isAbsolute()
                && uri.getRawUserInfo() == null
                && uri.getRawQuery() == null
                && uri.getRawFragment() == null
                && (!requireHttps || ("https".equalsIgnoreCase(uri.getScheme())
                    && StringUtils.hasText(uri.getHost())));
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}
