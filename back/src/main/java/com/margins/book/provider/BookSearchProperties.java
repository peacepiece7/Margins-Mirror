package com.margins.book.provider;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "margins.book-search")
public class BookSearchProperties {
    private boolean enabled = true;
    /** Legacy setting retained for runtime configuration compatibility; candidate search ignores it. */
    private boolean aiFallbackEnabled = false;
    private String provider = "google";
    private String baseUrl = "https://openlibrary.org";
    private String googleBaseUrl = "https://www.googleapis.com";
    private String googleApiKey = "";
    private int timeoutSeconds = 5;
    private int page = 1;
    private int limit = 5;
}
