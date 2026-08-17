package com.margins.persona.business;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.auth.support.AuthContext;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookRecord;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.persona.dto.PersonaDto;
import com.margins.persona.dto.PersonaListResponse;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** 저장된 책 분류로 AI 호출 없이 토론 페르소나 추천을 계산한다. */
@Component
@RequiredArgsConstructor
public class PersonaRecommendationBusiness {

    private static final List<String> FALLBACK = List.of("writer", "university-professor");

    private final BookMapper bookMapper;
    private final PersonaMapper personaMapper;
    private final ObjectMapper objectMapper;

    public PersonaListResponse recommend(Long bookId) {
        BookRecord book = bookMapper.findByIdForUser(bookId, AuthContext.requireUserId());
        if (book == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Book not found");
        }

        Set<String> preferred = preferredNames(classificationText(book.getRawMetadata()));
        List<PersonaRecord> active = personaMapper.findActiveForUser(AuthContext.requireUserId());
        List<PersonaDto> recommendations = new ArrayList<>();
        for (String name : preferred) {
            active.stream()
                .filter(persona -> name.equals(persona.getName()))
                .findFirst()
                .map(this::toDto)
                .ifPresent(recommendations::add);
            if (recommendations.size() == 2) {
                break;
            }
        }
        if (recommendations.size() < 2) {
            active.stream()
                .filter(persona -> recommendations.stream().noneMatch(dto -> dto.getPersonaId().equals(persona.getId())))
                .limit(2 - recommendations.size())
                .map(this::toDto)
                .forEach(recommendations::add);
        }
        return PersonaListResponse.builder().personas(recommendations).build();
    }

    private Set<String> preferredNames(String classification) {
        LinkedHashSet<String> names = new LinkedHashSet<>();
        if (containsAny(classification, "philosophy", "철학", "ethics", "윤리")) {
            names.add("university-professor");
            names.add("psychological-counselor");
        } else if (containsAny(classification, "econom", "경제", "business", "경영", "law", "법")) {
            names.add("journalist");
            names.add("lawyer");
        } else if (containsAny(classification, "science", "과학", "technology", "기술", "computer")) {
            names.add("developer");
            names.add("university-professor");
        } else if (containsAny(classification, "psychology", "심리", "self-help", "자기계발")) {
            names.add("psychological-counselor");
            names.add("neighborhood-grandmother");
        } else if (containsAny(classification, "fiction", "novel", "소설", "literature", "문학")) {
            names.add("writer");
            names.add("college-student");
        }
        names.addAll(FALLBACK);
        return names;
    }

    private String classificationText(String rawMetadata) {
        if (rawMetadata == null || rawMetadata.isBlank()) {
            return "";
        }
        try {
            JsonNode profile = objectMapper.readTree(rawMetadata).path("aiProfile");
            return (profile.path("genre").toString() + " " + profile.path("themes").toString())
                .toLowerCase(Locale.ROOT);
        } catch (Exception exception) {
            return "";
        }
    }

    private boolean containsAny(String value, String... candidates) {
        for (String candidate : candidates) {
            if (value.contains(candidate)) {
                return true;
            }
        }
        return false;
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
