package com.margins.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI marginsOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("Margins API")
                .version("0.0.1")
                .description("Reading record, AI reflection, persona debate, and metric snapshot APIs."));
    }
}
