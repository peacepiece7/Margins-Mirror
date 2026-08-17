package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.common.error.ApiErrorCode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class ApiErrorCodeContractTest {

    @Test
    void frontendPublicCodeUnionMatchesBackendEnum() throws Exception {
        String frontendTypes = Files.readString(
            Path.of("..", "front", "src", "types", "api", "api-response.ts")
        );
        Matcher matcher = Pattern.compile("'([A-Z][A-Z0-9_]+)'").matcher(frontendTypes);
        Set<String> frontendCodes = matcher.results()
            .map(result -> result.group(1))
            .collect(Collectors.toSet());
        Set<String> backendCodes = Arrays.stream(ApiErrorCode.values())
            .map(Enum::name)
            .collect(Collectors.toSet());

        assertThat(frontendCodes).containsExactlyInAnyOrderElementsOf(backendCodes);
    }

    @Test
    void publicErrorSourcesDoNotReintroduceLegacyReasonsOrMessages() throws Exception {
        try (Stream<Path> backendFiles = Files.walk(Path.of("src", "main", "java"))) {
            String backendSources = backendFiles
                .filter(path -> path.toString().endsWith(".java"))
                .map(this::read)
                .collect(Collectors.joining("\n"));
            assertThat(backendSources)
                .doesNotContain("new ResponseStatusException")
                .doesNotContain("new org.springframework.web.server.ResponseStatusException");
        }

        Pattern rawFrontendMessage = Pattern.compile(
            "\\b(?:error|exception|cause|[A-Za-z]+Error|[A-Za-z]+Exception|[A-Za-z]+Cause)\\.message\\b"
        );
        try (Stream<Path> frontendFiles = Files.walk(Path.of("..", "front", "src"))) {
            String frontendSources = frontendFiles
                .filter(path -> path.toString().endsWith(".ts") || path.toString().endsWith(".tsx"))
                .map(this::read)
                .collect(Collectors.joining("\n"));
            assertThat(rawFrontendMessage.matcher(frontendSources).find()).isFalse();
        }

        String apiContract = Files.readString(
            Path.of("..", "docs", "architecture", "api-contract", "sdd.md")
        );
        assertThat(apiContract).doesNotContain("message=");
    }

    private String read(Path path) {
        try {
            return Files.readString(path);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to inspect public error source " + path, exception);
        }
    }
}
