package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookRecord;
import com.margins.persona.business.PersonaRecommendationBusiness;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.persona.model.PersonaRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class PersonaRecommendationBusinessTest {

    @Test
    void recommendsFictionPersonasFromStoredProfileWithoutAiProvider() {
        BookMapper bookMapper = mock(BookMapper.class);
        PersonaMapper personaMapper = mock(PersonaMapper.class);
        when(bookMapper.findByIdForUser(7L, 1L)).thenReturn(BookRecord.builder()
            .id(7L)
            .userId(1L)
            .rawMetadata("{\"aiProfile\":{\"genre\":[\"literary fiction\"],\"themes\":[\"identity\"]}}")
            .build());
        when(personaMapper.findActiveForUser(1L)).thenReturn(List.of(
            persona(1L, "college-student"),
            persona(2L, "writer"),
            persona(3L, "university-professor")
        ));
        PersonaRecommendationBusiness business = new PersonaRecommendationBusiness(
            bookMapper, personaMapper, new ObjectMapper()
        );

        var response = business.recommend(7L);

        assertThat(response.getPersonas()).extracting("name")
            .containsExactly("writer", "college-student");
    }

    @Test
    void missingBookStopsBeforePersonaLookup() {
        BookMapper bookMapper = mock(BookMapper.class);
        PersonaMapper personaMapper = mock(PersonaMapper.class);
        PersonaRecommendationBusiness business = new PersonaRecommendationBusiness(
            bookMapper, personaMapper, new ObjectMapper()
        );

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> business.recommend(99L));

        verifyNoInteractions(personaMapper);
    }

    private PersonaRecord persona(Long id, String name) {
        return PersonaRecord.builder()
            .id(id)
            .name(name)
            .displayName(name)
            .active(true)
            .build();
    }
}
