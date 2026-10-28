package com.margins.reflectionloop.developer;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "margins.developer-debug")
public class DeveloperReflectionDraftProperties {
    private boolean enabled = false;
    private String runtimeEnvironment = "";
    private String model = "gpt-6-luna";
    private int maxOutputTokens = 500;
}
