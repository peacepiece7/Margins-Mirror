package com.margins;

import com.margins.ai.OpenAiProperties;
import com.margins.auth.config.AuthCookieProperties;
import com.margins.auth.config.AuthJwtProperties;
import com.margins.auth.config.AuthProperties;
import com.margins.auth.config.GoogleAuthProperties;
import com.margins.auth.config.MailVerificationProperties;
import com.margins.auth.config.ResendProperties;
import com.margins.auth.config.EmailVerificationAbuseProperties;
import com.margins.book.BookKnowledgeProperties;
import com.margins.moderation.ModerationProperties;
import com.margins.reflectionloop.ReflectionLoopProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
// @ConfigurationPropertiesScan Properties 많아지면 고려
@EnableConfigurationProperties({
    OpenAiProperties.class,
    AuthJwtProperties.class,
    AuthCookieProperties.class,
    AuthProperties.class,
    GoogleAuthProperties.class,
    MailVerificationProperties.class,
    ResendProperties.class,
    EmailVerificationAbuseProperties.class,
    ModerationProperties.class,
    ReflectionLoopProperties.class,
    BookKnowledgeProperties.class
})
public class MarginsBackApplication {

    public static void main(String[] args) {
        SpringApplication.run(MarginsBackApplication.class, args);
    }
}
