package com.margins.persona.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.persona.dto.CreatePersonaRequest;
import com.margins.persona.dto.PersonaListResponse;
import com.margins.persona.service.PersonaService;
import com.margins.persona.service.PersonaRecommendationService;
import jakarta.validation.constraints.Positive;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 페르소나 REST API 진입점이다.
 * 페르소나 생성과 목록 조회 요청을 서비스로 전달한다.
 */
@RestController
@RequestMapping("/api/personas")
@RequiredArgsConstructor
public class PersonaController {

    private final PersonaService personaService;
    private final PersonaRecommendationService personaRecommendationService;

    /** 토론에 사용할 활성 페르소나 목록을 조회하는 GET 엔드포인트다. */
    @GetMapping
    public ApiResponse<PersonaListResponse> activePersonas() {
        return ApiResponse.ok(personaService.findActive());
    }

    /** 저장된 책 분류로 최대 두 명의 토론 페르소나를 추천한다. */
    @GetMapping("/recommendations")
    public ApiResponse<PersonaListResponse> recommendations(@RequestParam @Positive Long bookId) {
        return ApiResponse.ok(personaRecommendationService.recommend(bookId));
    }

    /** 새 토론 페르소나를 생성하는 POST 엔드포인트다. */
    @PostMapping
    public ApiResponse<PersonaListResponse> create(@Valid @RequestBody CreatePersonaRequest request) {
        return ApiResponse.ok(personaService.create(request));
    }
}
