package com.margins.testsupport.business;

/**
 * 테스트 데이터 초기화 실행기의 공통 계약이다.
 * 환경별 reset 구현을 비즈니스 로직에서 분리한다.
 */
public interface TestDataResetExecutor {
    void resetTestData();
}
