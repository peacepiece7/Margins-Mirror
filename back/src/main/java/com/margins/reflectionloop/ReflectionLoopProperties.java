package com.margins.reflectionloop;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "margins.reflection-loop")
public class ReflectionLoopProperties {
    private boolean enabled = false;
    private String interviewPromptVersion = "reflection-interview-v1";
    private String guidePromptVersion = "discussion-guide-v1";
    private String directorVersion = "discussion-director-v1";
    private String refinementPromptVersion = "reflection-refinement-v1";
    private int perspectiveClaimTtlSeconds = 120;
}
