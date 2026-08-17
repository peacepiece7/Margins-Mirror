package com.margins.book;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "margins.book-knowledge")
public class BookKnowledgeProperties {
    private int freshDays = 30;
    private int fallbackDays = 365;
    private int claimTtlSeconds = 120;
    private boolean requireProvider = false;
}
