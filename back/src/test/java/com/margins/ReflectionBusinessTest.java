package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.margins.common.error.ApiException;
import com.margins.reflectionloop.ReflectionLoopProperties;
import com.margins.reflectionloop.business.ReflectionBusiness;
import com.margins.reflectionloop.mapper.DiscussionGuideMapper;
import com.margins.reflectionloop.mapper.DiscussionRunMapper;
import com.margins.reflectionloop.mapper.ReflectionInterviewMapper;
import com.margins.reflectionloop.mapper.ReflectionRevisionMapper;
import com.margins.reflectionloop.model.ReflectionRevisionRecord;
import com.margins.reflectionloop.model.dto.request.SaveReflectionRequest;
import com.margins.session.mapper.SessionInsightMapper;
import com.margins.session.model.SessionInsightRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class ReflectionBusinessTest {

    @Test
    void firstSaveCreatesCurrentProjectionAndImmutableRevisionOne() {
        ReflectionLoopProperties properties = new ReflectionLoopProperties();
        properties.setEnabled(true);
        ReflectionRevisionMapper revisionMapper = mock(ReflectionRevisionMapper.class);
        SessionInsightMapper insightMapper = mock(SessionInsightMapper.class);
        AtomicReference<ReflectionRevisionRecord> savedRevision = new AtomicReference<>();
        when(revisionMapper.lockOwnedSession(10L, 1L)).thenReturn(10L);
        when(revisionMapper.findPrimaryReflection(10L, 1L)).thenReturn(null);
        when(insightMapper.selectNextOrder(10L)).thenReturn(1);
        doAnswer(invocation -> {
            SessionInsightRecord reflection = invocation.getArgument(0);
            reflection.setId(20L);
            return 1;
        }).when(insightMapper).insert(any());
        when(revisionMapper.nextRevisionVersion(20L)).thenReturn(1);
        doAnswer(invocation -> {
            ReflectionRevisionRecord revision = invocation.getArgument(0);
            revision.setId(30L);
            savedRevision.set(revision);
            return 1;
        }).when(revisionMapper).insertRevision(any());
        when(revisionMapper.findRevisions(20L, 1L))
            .thenAnswer(invocation -> List.of(savedRevision.get()));
        ReflectionBusiness business = business(properties, revisionMapper, insightMapper);

        var response = business.create(10L, SaveReflectionRequest.builder()
            .content("  아직 미완성인 생각  ")
            .visibility("PUBLIC")
            .build());

        assertThat(response.getCurrentRevision().getVersion()).isEqualTo(1);
        assertThat(response.getCurrentRevision().getContent()).isEqualTo("아직 미완성인 생각");
        assertThat(response.getVisibility()).isEqualTo("PUBLIC");
        assertThat(savedRevision.get().getRevisionSource()).isEqualTo("INITIAL");
        assertThat(savedRevision.get().getUserId()).isEqualTo(1L);
    }

    @Test
    void secondPrimaryReflectionForSameSessionIsRejected() {
        ReflectionLoopProperties properties = new ReflectionLoopProperties();
        properties.setEnabled(true);
        ReflectionRevisionMapper revisionMapper = mock(ReflectionRevisionMapper.class);
        SessionInsightMapper insightMapper = mock(SessionInsightMapper.class);
        when(revisionMapper.lockOwnedSession(10L, 1L)).thenReturn(10L);
        when(revisionMapper.findPrimaryReflection(10L, 1L)).thenReturn(
            SessionInsightRecord.builder().id(20L).sessionId(10L).userId(1L).build()
        );
        ReflectionBusiness business = business(properties, revisionMapper, insightMapper);

        assertThatThrownBy(() -> business.create(
            10L,
            SaveReflectionRequest.builder().content("another").build()
        ))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).getCode().name())
                .isEqualTo("COMMON_CONFLICT"));
        verify(insightMapper, never()).insert(any());
    }

    @Test
    void sessionPrimaryReadUsesOwnerScopedPrimaryAndExplainsEmptyState() {
        ReflectionLoopProperties properties = new ReflectionLoopProperties();
        properties.setEnabled(true);
        ReflectionRevisionMapper revisionMapper = mock(ReflectionRevisionMapper.class);
        SessionInsightMapper insightMapper = mock(SessionInsightMapper.class);
        when(revisionMapper.findPrimaryReflection(10L, 1L)).thenReturn(null);
        ReflectionBusiness business = business(properties, revisionMapper, insightMapper);

        assertThatThrownBy(() -> business.getPrimaryBySession(10L))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> {
                ApiException apiException = (ApiException) error;
                assertThat(apiException.getCode().name()).isEqualTo("COMMON_NOT_FOUND");
                assertThat(apiException.getReason()).contains("Primary Reflection");
                assertThat(apiException.getPublicMessage()).contains("아직 작성된 Reflection");
            });
        verify(revisionMapper).findPrimaryReflection(10L, 1L);
    }

    @Test
    void disabledFlagRejectsCanonicalMutationWithoutTouchingPersistence() {
        ReflectionLoopProperties properties = new ReflectionLoopProperties();
        properties.setEnabled(false);
        ReflectionRevisionMapper revisionMapper = mock(ReflectionRevisionMapper.class);
        SessionInsightMapper insightMapper = mock(SessionInsightMapper.class);
        ReflectionBusiness business = business(properties, revisionMapper, insightMapper);

        assertThatThrownBy(() -> business.create(
            10L,
            SaveReflectionRequest.builder().content("draft").build()
        ))
            .isInstanceOf(ApiException.class)
            .satisfies(error -> assertThat(((ApiException) error).getCode().name())
                .isEqualTo("COMMON_NOT_FOUND"));
        verifyNoPersistence(revisionMapper, insightMapper);
    }

    private ReflectionBusiness business(
        ReflectionLoopProperties properties,
        ReflectionRevisionMapper revisionMapper,
        SessionInsightMapper insightMapper
    ) {
        return new ReflectionBusiness(
            properties,
            revisionMapper,
            mock(ReflectionInterviewMapper.class),
            mock(DiscussionGuideMapper.class),
            mock(DiscussionRunMapper.class),
            insightMapper
        );
    }

    private void verifyNoPersistence(
        ReflectionRevisionMapper revisionMapper,
        SessionInsightMapper insightMapper
    ) {
        verify(revisionMapper, never()).lockOwnedSession(any(), any());
        verify(insightMapper, never()).insert(any());
    }
}
