package com.margins.reflectionloop.developer;

import com.margins.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class DeveloperReflectionDraftController {
    private final DeveloperReflectionDraftService service;

    @PostMapping("/api/developer/reflection-drafts")
    public ApiResponse<DeveloperReflectionDraftResponse> generate(
        @Valid @RequestBody DeveloperReflectionDraftRequest request
    ) {
        return ApiResponse.ok(service.generate(request));
    }
}
