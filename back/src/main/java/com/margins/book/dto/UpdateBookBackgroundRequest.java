package com.margins.book.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.AssertTrue;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class UpdateBookBackgroundRequest {
    @Size(max = 10000)
    String summary;
    @NotNull
    @Min(0)
    Integer expectedRevision;

    @JsonIgnore
    @AssertTrue(message = "summary must be explicitly supplied, including null to restore")
    boolean summaryProvided;

    public static class UpdateBookBackgroundRequestBuilder {
        /** 내부 존재 플래그를 JSON 입력으로 설정하지 못하게 한다. */
        @JsonIgnore
        public UpdateBookBackgroundRequestBuilder summaryProvided(boolean ignored) {
            return this;
        }

        /** 누락된 필드와 명시적인 null(원본 복원)을 구분한다. */
        public UpdateBookBackgroundRequestBuilder summary(String summary) {
            this.summary = summary;
            this.summaryProvided = true;
            return this;
        }
    }
}
