package com.margins.reflectionloop.model.dto.response;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MobileReflectionThreadListResponse {
    List<MobileReflectionThreadItemResponse> threads;
}
