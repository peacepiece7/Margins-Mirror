package com.margins.persona.service;

import com.margins.persona.business.PersonaRecommendationBusiness;
import com.margins.persona.dto.PersonaListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 책 분류 기반 페르소나 추천 요청을 읽기 전용 트랜잭션으로 실행한다. */
@Service
@RequiredArgsConstructor
public class PersonaRecommendationService {

    private final PersonaRecommendationBusiness personaRecommendationBusiness;

    @Transactional(readOnly = true)
    public PersonaListResponse recommend(Long bookId) {
        return personaRecommendationBusiness.recommend(bookId);
    }
}
