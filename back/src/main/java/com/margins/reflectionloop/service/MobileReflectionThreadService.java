package com.margins.reflectionloop.service;

import com.margins.reflectionloop.business.MobileReflectionThreadBusiness;
import com.margins.reflectionloop.model.dto.response.MobileReflectionThreadListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MobileReflectionThreadService {
    private final MobileReflectionThreadBusiness threadBusiness;

    @Transactional(readOnly = true)
    public MobileReflectionThreadListResponse findReadingThreads() {
        return threadBusiness.findReadingThreads();
    }
}
