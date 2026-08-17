package com.margins.testsupport.service;

import com.margins.testsupport.business.TestResetBusiness;
import com.margins.testsupport.dto.ResetResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 컨트롤러와 테스트 reset 비즈니스 로직 사이의 서비스 계층이다.
 * 초기화 요청을 실행기로 위임하고 결과 DTO를 반환한다.
 */
@Service
@RequiredArgsConstructor
public class TestResetService {

    private final TestResetBusiness testResetBusiness;

    @Transactional
    public ResetResponse reset() {
        return testResetBusiness.reset();
    }
}
