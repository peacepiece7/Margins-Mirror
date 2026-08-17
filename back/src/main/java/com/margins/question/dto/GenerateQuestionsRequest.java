package com.margins.question.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class GenerateQuestionsRequest {
    @Min(1)
    @Max(5)
    Integer count;
    String focus;
}
