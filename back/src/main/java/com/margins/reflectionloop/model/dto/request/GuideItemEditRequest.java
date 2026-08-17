package com.margins.reflectionloop.model.dto.request;

import jakarta.validation.constraints.Max;
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
public class GuideItemEditRequest {
    @NotNull
    Long itemId;
    @NotBlank
    @Size(max = 1000)
    String question;
    @NotBlank
    @Size(max = 1000)
    String intent;
    @NotNull
    @Min(1)
    @Max(20)
    Integer expectedMinutes;
    @NotNull
    @Size(max = 2)
    List<@NotBlank @Size(max = 1000) String> followUps;
}
