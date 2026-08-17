package com.margins.health;

import com.margins.common.dto.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 애플리케이션 상태 확인 REST API 진입점이다.
 * 배포와 로컬 실행에서 서버 생존 여부를 확인한다.
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    /** 서버 상태가 정상인지 확인하는 GET 엔드포인트다. */
    @GetMapping
    public ApiResponse<Map<String, String>> health() {
        return ApiResponse.ok(Map.of("status", "UP"));
    }
}
