package com.margins.testsupport.business;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.testsupport.dto.ResetResponse;
import java.util.Arrays;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * 테스트 reset API의 업무 규칙을 처리한다.
 * 허용된 profile에서만 테스트 데이터 초기화를 실행하도록 보호한다.
 */
@Component
public class TestResetBusiness {

    private final Environment environment;
    private final TestDataResetExecutor testDataResetExecutor;

    public TestResetBusiness(Environment environment, TestDataResetExecutor testDataResetExecutor) {
        this.environment = environment;
        this.testDataResetExecutor = testDataResetExecutor;
    }

    public ResetResponse reset() {
        if (!isResetAllowed()) {
            throw new ApiException(ApiErrorCode.COMMON_FORBIDDEN, "reset is only available in local/test profiles");
        }

        testDataResetExecutor.resetTestData();

        return ResetResponse.builder()
            .reset(true)
            .mode("jdbc-seed-reset")
            .build();
    }

    public boolean isResetAllowed() {
        return Arrays.stream(environment.getActiveProfiles())
            .anyMatch(profile -> profile.equals("local") || profile.equals("test"));
    }
}
