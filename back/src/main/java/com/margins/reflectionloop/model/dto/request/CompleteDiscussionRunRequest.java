package com.margins.reflectionloop.model.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class CompleteDiscussionRunRequest {
    @Size(max = 12000)
    String closingNote;
}
