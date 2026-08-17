package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import com.margins.testsupport.TestSecurityContextSupport;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.margins.testsupport.TestSecurityContextSupport;

import com.margins.persona.business.PersonaBusiness;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.persona.dto.CreatePersonaRequest;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.persona.dto.PersonaListResponse;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.persona.mapper.PersonaMapper;
import com.margins.testsupport.TestSecurityContextSupport;
import com.margins.persona.model.PersonaRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.ArrayList;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.List;
import com.margins.testsupport.TestSecurityContextSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import com.margins.testsupport.TestSecurityContextSupport;
import org.springframework.http.HttpStatus;
import com.margins.testsupport.TestSecurityContextSupport;
import org.springframework.web.server.ResponseStatusException;
import com.margins.testsupport.TestSecurityContextSupport;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class PersonaBusinessTest {

    @Test
    void findActiveReturnsPersonaDtosInMapperOrder() {
        PersonaBusiness business = new PersonaBusiness(new FakePersonaMapper());

        PersonaListResponse response = business.findActive();

        assertThat(response.getPersonas()).hasSize(12);
        assertThat(response.getPersonas().get(0).getPersonaId()).isEqualTo(13L);
        assertThat(response.getPersonas().get(0).getDisplayName()).isEqualTo("심리상담사");
        assertThat(response.getPersonas().get(1).getTone()).isEqualTo("맥락과 의도");
    }

    @Test
    void createPersistsReaderPersonaAndReturnsActiveList() {
        FakePersonaMapper mapper = new FakePersonaMapper();
        PersonaBusiness business = new PersonaBusiness(mapper);

        PersonaListResponse response = business.create(CreatePersonaRequest.builder()
            .displayName("Skeptical Historian")
            .description("Checks claims against historical context.")
            .systemPrompt("Respond as a skeptical historian.")
            .tone("skeptical")
            .build());

        assertThat(mapper.inserted.getName()).startsWith("reader-skeptical-historian-");
        assertThat(mapper.inserted.getSystemPrompt()).isEqualTo("Respond as a skeptical historian.");
        assertThat(mapper.inserted.isActive()).isTrue();
        assertThat(response.getPersonas()).extracting("displayName").contains("Skeptical Historian");
    }

    @Test
    void createRejectsZeroRowInsert() {
        FakePersonaMapper mapper = new FakePersonaMapper();
        mapper.insertRows = 0;
        PersonaBusiness business = new PersonaBusiness(mapper);

        assertThatThrownBy(() -> business.create(CreatePersonaRequest.builder()
            .displayName("Silent Reviewer")
            .systemPrompt("Review silently.")
            .build()))
            .isInstanceOfSatisfying(ResponseStatusException.class, (exception) -> {
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                assertThat(exception.getReason()).isEqualTo("Persona could not be saved");
            });
    }

    private static class FakePersonaMapper implements PersonaMapper {
        private PersonaRecord inserted;
        private final List<PersonaRecord> customPersonas = new ArrayList<>();
        private int insertRows = 1;

        @Override
        public int insert(PersonaRecord record) {
            record.setId(100L + customPersonas.size());
            inserted = record;
            customPersonas.add(record);
            return insertRows;
        }

        @Override
        public List<PersonaRecord> findActive() {
            List<PersonaRecord> seedPersonas = List.of(
                PersonaRecord.builder()
                    .id(13L)
                    .name("psychological-counselor")
                    .displayName("심리상담사")
                    .description("personaType: character; primaryLens: emotion, motive, relationship.")
                    .tone("감정과 심리")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(14L)
                    .name("journalist")
                    .displayName("기자")
                    .description("personaType: character; primaryLens: facts, context, intent.")
                    .tone("맥락과 의도")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(15L)
                    .name("elementary-school-teacher")
                    .displayName("초등학교 선생님")
                    .description("personaType: character; primaryLens: simple explanation, kindness.")
                    .tone("쉽고 따뜻한 설명")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(16L)
                    .name("college-student")
                    .displayName("대학생")
                    .description("personaType: character; primaryLens: curiosity, identity, future.")
                    .tone("또래의 질문과 성장")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(17L)
                    .name("neighborhood-grandmother")
                    .displayName("옆집 할머니")
                    .description("personaType: character; primaryLens: lived experience, care, memory.")
                    .tone("생활감과 지혜")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(18L)
                    .name("soldier")
                    .displayName("군인")
                    .description("personaType: character; primaryLens: duty, discipline, survival.")
                    .tone("책임과 선택")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(19L)
                    .name("middle-school-teacher")
                    .displayName("중학교 교사")
                    .description("personaType: character; primaryLens: adolescence, learning, conflict mediation.")
                    .tone("성장과 갈등 조율")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(20L)
                    .name("lawyer")
                    .displayName("변호사")
                    .description("personaType: character; primaryLens: argument, evidence, responsibility.")
                    .tone("논증과 책임")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(21L)
                    .name("university-professor")
                    .displayName("대학교수")
                    .description("personaType: character; primaryLens: theory, synthesis, conceptual framing.")
                    .tone("개념과 종합")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(22L)
                    .name("doctor")
                    .displayName("의사")
                    .description("personaType: character; primaryLens: body, health, risk, care.")
                    .tone("몸과 돌봄")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(23L)
                    .name("developer")
                    .displayName("개발자")
                    .description("personaType: character; primaryLens: system, structure, pattern.")
                    .tone("구조와 패턴")
                    .active(true)
                    .build(),
                PersonaRecord.builder()
                    .id(24L)
                    .name("writer")
                    .displayName("작가")
                    .description("personaType: character; primaryLens: style, voice, scene.")
                    .tone("문체와 표현")
                    .active(true)
                    .build()
            );
            List<PersonaRecord> personas = new ArrayList<>(seedPersonas);
            personas.addAll(customPersonas);
            return personas;
        }

        @Override
        public List<PersonaRecord> findActiveForUser(Long userId) {
            return findActive();
        }

        @Override
        public PersonaRecord findActiveById(Long id) {
            return findActive().stream()
                .filter((persona) -> persona.getId().equals(id))
                .findFirst()
                .orElse(null);
        }

        @Override
        public PersonaRecord findActiveByIdForUser(Long id, Long userId) {
            return findActiveById(id);
        }
    }
}
