package com.margins.moderation;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "margins.ai.moderator")
public class ModerationProperties {
    private boolean enabled;
    private String policyVersion = "moderator-policy-v1";
    private String promptVersion = "moderator-prompt-v1";
    private String schemaVersion = "moderator-schema-v1";
}
