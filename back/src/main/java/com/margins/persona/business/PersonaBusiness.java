package com.margins.persona.business;

import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.auth.support.AuthContext;
import com.margins.persona.dto.CreatePersonaRequest;
import com.margins.persona.dto.PersonaDto;
import com.margins.persona.dto.PersonaListResponse;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 페르소나 도메인의 핵심 업무 규칙을 처리한다.
 * AI 토론 참여자 생성과 목록 조회, 기본 페르소나 관리를 조율한다.
 */
@Component
@RequiredArgsConstructor
public class PersonaBusiness {

    private final PersonaMapper personaMapper;

    public PersonaListResponse findActive() {
        return PersonaListResponse.builder()
            .personas(personaMapper.findActiveForUser(AuthContext.requireUserId()).stream().map(this::toDto).toList())
            .build();
    }

    public PersonaListResponse create(CreatePersonaRequest request) {
        PersonaRecord record = PersonaRecord.builder()
            .name(uniqueInternalName(request.getDisplayName()))
            .displayName(request.getDisplayName())
            .description(request.getDescription())
            .systemPrompt(request.getSystemPrompt())
            .tone(request.getTone())
            .createdByUserId(AuthContext.requireUserId())
            .active(true)
            .build();

        if (personaMapper.insert(record) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Persona could not be saved");
        }
        return findActive();
    }

    private String uniqueInternalName(String displayName) {
        String slug = displayName.toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-|-$)", "");
        String base = slug.isBlank() ? "reader-persona" : slug;
        return "reader-" + base + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private PersonaDto toDto(PersonaRecord record) {
        return PersonaDto.builder()
            .personaId(record.getId())
            .name(record.getName())
            .displayName(record.getDisplayName())
            .description(record.getDescription())
            .tone(record.getTone())
            .build();
    }
}
