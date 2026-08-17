package com.margins.reflectionloop.model.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
public class EditDiscussionGuideRequest {
    @NotNull
    @Min(1)
    Integer expectedVersion;
    @NotBlank
    @Size(max = 500)
    String goal;
    @NotNull
    @Size(min = 2, max = 4)
    List<@NotBlank @Size(max = 500) String> issues;
    @NotNull
    @Size(min = 5, max = 8)
    List<@Valid GuideItemEditRequest> items;
}
