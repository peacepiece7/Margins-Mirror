package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.margins.reflectionloop.business.MobileReflectionThreadBusiness;
import com.margins.reflectionloop.business.ReflectionBusiness;
import com.margins.reflectionloop.business.ReflectionInterviewBusiness;
import com.margins.reflectionloop.mapper.MobileReflectionThreadMapper;
import com.margins.reflectionloop.model.MobileReflectionThreadRecord;
import com.margins.reflectionloop.model.dto.response.MobileReflectionThreadItemResponse;
import com.margins.testsupport.TestSecurityContextSupport;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class MobileReflectionThreadBusinessTest {

    @Test
    void mapsOwnerScopedReadingThreadsWithCanonicalInterviewTarget() {
        ReflectionBusiness reflectionBusiness = mock(ReflectionBusiness.class);
        MobileReflectionThreadMapper mapper = mock(MobileReflectionThreadMapper.class);
        LocalDateTime lastActivityAt = LocalDateTime.of(2026, 8, 31, 11, 30);
        when(mapper.findReadingThreads(1L)).thenReturn(List.of(
            MobileReflectionThreadRecord.builder()
                .bookId(42L)
                .bookTitle("The Dispossessed")
                .bookAuthor("Ursula K. Le Guin")
                .coverImageUrl("https://example.com/cover.jpg")
                .sessionId(10L)
                .reflectionId(20L)
                .revisionCount(2)
                .reflectionPreview("A record of an unfinished thought")
                .interviewId(30L)
                .interviewStatus("ACTIVE")
                .answeredCount(3)
                .generatedCount(4)
                .currentQuestion("What changed as you read?")
                .refinementOutcome("KEPT")
                .lastActivityAt(lastActivityAt)
                .build()
        ));

        MobileReflectionThreadItemResponse thread =
            new MobileReflectionThreadBusiness(reflectionBusiness, mapper)
                .findReadingThreads()
                .getThreads()
                .getFirst();

        assertThat(thread.getBookId()).isEqualTo(42L);
        assertThat(thread.getInterviewId()).isEqualTo(30L);
        assertThat(thread.getAnsweredCount()).isEqualTo(3);
        assertThat(thread.getTargetAnswers()).isEqualTo(ReflectionInterviewBusiness.TARGET_ANSWERS);
        assertThat(thread.getCurrentQuestion()).isEqualTo("What changed as you read?");
        assertThat(thread.getRefinementOutcome()).isEqualTo("KEPT");
        assertThat(thread.getLastActivityAt()).isEqualTo(lastActivityAt);
        verify(reflectionBusiness).requireEnabled();
        verify(mapper).findReadingThreads(1L);
    }

    @Test
    void leavesInterviewProgressAbsentWhenNoInterviewExists() {
        ReflectionBusiness reflectionBusiness = mock(ReflectionBusiness.class);
        MobileReflectionThreadMapper mapper = mock(MobileReflectionThreadMapper.class);
        when(mapper.findReadingThreads(1L)).thenReturn(List.of(
            MobileReflectionThreadRecord.builder().bookId(42L).bookTitle("Book").build()
        ));

        MobileReflectionThreadItemResponse thread =
            new MobileReflectionThreadBusiness(reflectionBusiness, mapper)
                .findReadingThreads()
                .getThreads()
                .getFirst();

        assertThat(thread.getTargetAnswers()).isNull();
    }

    @Test
    void doesNotQueryThreadsWhenReflectionLoopIsDisabled() {
        ReflectionBusiness reflectionBusiness = mock(ReflectionBusiness.class);
        MobileReflectionThreadMapper mapper = mock(MobileReflectionThreadMapper.class);
        doThrow(new IllegalStateException("disabled"))
            .when(reflectionBusiness)
            .requireEnabled();

        MobileReflectionThreadBusiness business =
            new MobileReflectionThreadBusiness(reflectionBusiness, mapper);

        assertThatThrownBy(business::findReadingThreads)
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("disabled");
        verify(mapper, never()).findReadingThreads(1L);
    }
}
