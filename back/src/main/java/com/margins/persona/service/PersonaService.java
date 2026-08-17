package com.margins.persona.service;

import com.margins.persona.business.PersonaBusiness;
import com.margins.persona.dto.CreatePersonaRequest;
import com.margins.persona.dto.PersonaListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 컨트롤러와 페르소나 비즈니스 로직 사이의 서비스 계층이다.
 * 페르소나 요청을 업무 규칙으로 위임하고 DTO로 반환한다.
 */
@Service
@RequiredArgsConstructor
public class PersonaService {

    private final PersonaBusiness personaBusiness;

    @Transactional(readOnly = true)
    public PersonaListResponse findActive() {
        return personaBusiness.findActive();
    }

    @Transactional
    public PersonaListResponse create(CreatePersonaRequest request) {
        return personaBusiness.create(request);
    }
}
