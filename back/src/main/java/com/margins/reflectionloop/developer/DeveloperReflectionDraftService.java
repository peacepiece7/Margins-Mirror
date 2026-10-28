package com.margins.reflectionloop.developer;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeveloperReflectionDraftService {
    private final DeveloperReflectionDraftBusiness business;

    public DeveloperReflectionDraftResponse generate(DeveloperReflectionDraftRequest request) {
        return business.generate(request);
    }
}
