package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.margins.ai.AiGenerationResult;
import com.margins.ai.AiGenerationObserver;
import com.margins.ai.AiGenerationTask;
import com.margins.ai.AiLanguageValidationOutcome;
import com.margins.ai.AiProvider;
import com.margins.ai.AiTokenUsage;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.GenerationLocale;
import com.margins.ai.GenerationLocaleResolver;
import com.margins.book.BookKnowledgeProperties;
import com.margins.book.business.BookKnowledgeBusiness;
import com.margins.book.dto.BookKnowledgeDto;
import com.margins.book.mapper.BookKnowledgeMapper;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookKnowledgeRecord;
import com.margins.book.model.BookKnowledgeStatus;
import com.margins.book.model.BookRecord;
import com.margins.common.error.ApiErrorCode;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.LoggerFactory;
import org.springframework.test.util.ReflectionTestUtils;

class BookKnowledgeBusinessTest {
    private BookKnowledgeMapper knowledgeMapper;
    private BookMapper bookMapper;
    private AiProvider aiProvider;
    private BookKnowledgeProperties properties;
    private GenerationLocaleResolver localeResolver;
    private BookKnowledgeBusiness business;

    @BeforeEach
    void setUp() {
        knowledgeMapper = mock(BookKnowledgeMapper.class);
        bookMapper = mock(BookMapper.class);
        aiProvider = mock(AiProvider.class);
        localeResolver = mock(GenerationLocaleResolver.class);
        properties = new BookKnowledgeProperties();
        properties.setFreshDays(30);
        properties.setFallbackDays(365);
        properties.setClaimTtlSeconds(120);
        business = new BookKnowledgeBusiness(
            knowledgeMapper,
            bookMapper,
            aiProvider,
            properties,
            localeResolver,
            new AiOutputLanguageValidator()
        );
    }

    @Test
    void reusesFreshCurrentProviderKnowledgeWithoutCallingProvider() {
        BookRecord book = book();
        BookKnowledgeRecord current = ready(
            10L,
            BookKnowledgeBusiness.PROMPT_VERSION,
            LocalDateTime.now().minusDays(2),
            false
        );
        when(knowledgeMapper.findByIdentityAndPromptVersion(
            "isbn",
            "9781234567890",
            BookKnowledgeBusiness.PROMPT_VERSION,
            "ko"
        )).thenReturn(current);

        BookKnowledgeBusiness.ResolvedKnowledge resolved = business.ensureKnowledge(
            book, GenerationLocale.KO
        );

        assertThat(resolved.record().getId()).isEqualTo(10L);
        assertThat(resolved.stale()).isFalse();
        assertThat(resolved.fallbackUsed()).isFalse();
        verify(aiProvider, never()).analyzeBookKnowledgeWithMetadata(any());
    }

    @Test
    void refreshesStaleCurrentKnowledgeUnderOneClaim() {
        BookRecord book = book();
        BookKnowledgeRecord stale = ready(
            11L,
            BookKnowledgeBusiness.PROMPT_VERSION,
            LocalDateTime.now().minusDays(40),
            false
        );
        when(knowledgeMapper.findByIdentityAndPromptVersion(
            "isbn",
            "9781234567890",
            BookKnowledgeBusiness.PROMPT_VERSION,
            "ko"
        )).thenReturn(stale);
        when(knowledgeMapper.claimGeneration(any(), anyString(), anyString(), anyInt())).thenReturn(1);
        when(knowledgeMapper.findLatestReadyByIdentity("isbn", "9781234567890", "ko"))
            .thenReturn(stale);
        when(aiProvider.analyzeBookKnowledgeWithMetadata(any()))
            .thenReturn(success(analyzed(), false));
        when(knowledgeMapper.completeGeneration(any())).thenReturn(1);

        BookKnowledgeBusiness.ResolvedKnowledge resolved = business.ensureKnowledge(
            book, GenerationLocale.KO
        );

        assertThat(resolved.record().getId()).isEqualTo(11L);
        assertThat(resolved.record().getSummary()).isEqualTo("새 분석 요약");
        assertThat(resolved.stale()).isFalse();
        assertThat(resolved.refreshPending()).isFalse();
        ArgumentCaptor<BookKnowledgeRecord> completed =
            ArgumentCaptor.forClass(BookKnowledgeRecord.class);
        verify(knowledgeMapper).completeGeneration(completed.capture());
        assertThat(completed.getValue().getGenerationClaimToken()).isNotBlank();
        assertThat(completed.getValue().getGenerationLocale()).isEqualTo("ko");
        assertThat(completed.getValue().getLanguageValidationOutcome()).isEqualTo("MATCH");
        assertThat(completed.getValue().getStatus()).isEqualTo(BookKnowledgeStatus.READY);
        ArgumentCaptor<com.margins.book.dto.BookKnowledgeAnalyzeRequest> request =
            ArgumentCaptor.forClass(com.margins.book.dto.BookKnowledgeAnalyzeRequest.class);
        verify(aiProvider).analyzeBookKnowledgeWithMetadata(request.capture());
        assertThat(request.getValue().getGenerationLocale()).isEqualTo(GenerationLocale.KO);
    }

    @Test
    void activeClaimReturnsCurrentSnapshotWithoutDuplicateProviderCall() {
        BookRecord book = book();
        BookKnowledgeRecord pending = ready(
            12L,
            BookKnowledgeBusiness.PROMPT_VERSION,
            LocalDateTime.now().minusDays(40),
            false
        );
        pending.setGenerationClaimToken("active-claim");
        pending.setGenerationClaimedAt(LocalDateTime.now().minusSeconds(10));
        when(knowledgeMapper.findByIdentityAndPromptVersion(
            "isbn",
            "9781234567890",
            BookKnowledgeBusiness.PROMPT_VERSION,
            "ko"
        )).thenReturn(pending);
        when(knowledgeMapper.hasActiveGenerationClaim(12L, "ko", 120)).thenReturn(true);
        when(knowledgeMapper.claimGeneration(any(), anyString(), anyString(), anyInt())).thenReturn(0);

        BookKnowledgeBusiness.ResolvedKnowledge resolved = business.ensureKnowledge(
            book, GenerationLocale.KO
        );

        assertThat(resolved.record().getId()).isEqualTo(12L);
        assertThat(resolved.refreshPending()).isTrue();
        verify(aiProvider, never()).analyzeBookKnowledgeWithMetadata(any());
    }

    @Test
    void providerFallbackKeepsRecentPreviousProviderKnowledge() {
        BookRecord book = book();
        BookKnowledgeRecord previous = ready(
            20L,
            "book-knowledge-v0",
            LocalDateTime.now().minusDays(10),
            false
        );
        when(knowledgeMapper.findByIdentityAndPromptVersion(
            "isbn",
            "9781234567890",
            BookKnowledgeBusiness.PROMPT_VERSION,
            "ko"
        )).thenReturn(null);
        when(knowledgeMapper.findLatestReadyByIdentity("isbn", "9781234567890", "ko"))
            .thenReturn(previous);
        when(knowledgeMapper.insert(any())).thenAnswer(invocation -> {
            BookKnowledgeRecord inserted = invocation.getArgument(0);
            inserted.setId(21L);
            return 1;
        });
        when(aiProvider.analyzeBookKnowledgeWithMetadata(any()))
            .thenReturn(success(analyzed(), true));
        when(knowledgeMapper.failGeneration(any(), anyString(), anyString(), anyString())).thenReturn(1);

        BookKnowledgeBusiness.ResolvedKnowledge resolved = business.ensureKnowledge(
            book, GenerationLocale.KO
        );

        assertThat(resolved.record().getId()).isEqualTo(20L);
        assertThat(resolved.stale()).isTrue();
        assertThat(resolved.fallbackUsed()).isTrue();
        verify(knowledgeMapper, never()).completeGeneration(any());
    }

    @Test
    void strictProviderModeDoesNotPersistPlaceholderWhenNoPreviousKnowledgeExists() {
        properties.setRequireProvider(true);
        BookRecord book = book();
        when(knowledgeMapper.findByIdentityAndPromptVersion(
            "isbn",
            "9781234567890",
            BookKnowledgeBusiness.PROMPT_VERSION,
            "ko"
        )).thenReturn(null);
        when(knowledgeMapper.findLatestReadyByIdentity("isbn", "9781234567890", "ko"))
            .thenReturn(null);
        when(knowledgeMapper.insert(any())).thenAnswer(invocation -> {
            BookKnowledgeRecord inserted = invocation.getArgument(0);
            inserted.setId(22L);
            return 1;
        });
        when(aiProvider.analyzeBookKnowledgeWithMetadata(any()))
            .thenReturn(success(analyzed(), true));
        when(knowledgeMapper.failGeneration(any(), anyString(), anyString(), anyString())).thenReturn(1);

        assertThatThrownBy(() -> business.ensureKnowledge(book, GenerationLocale.KO))
            .isInstanceOf(com.margins.common.error.ApiException.class)
            .extracting(exception -> ((com.margins.common.error.ApiException) exception).getCode())
            .isEqualTo(ApiErrorCode.COMMON_UPSTREAM_ERROR);
        verify(knowledgeMapper, never()).completeGeneration(any());
    }

    @Test
    void knownMismatchIsReplacedBeforeLocaleRowIsCompleted() {
        BookRecord book = book();
        AtomicReference<AiGenerationResult<?>> observed = observeGeneration();
        when(knowledgeMapper.findByIdentityAndPromptVersion(
            "isbn", "9781234567890", BookKnowledgeBusiness.PROMPT_VERSION, "ko"
        )).thenReturn(null);
        when(knowledgeMapper.findLatestReadyByIdentity("isbn", "9781234567890", "ko"))
            .thenReturn(null);
        when(knowledgeMapper.insert(any())).thenAnswer(invocation -> {
            BookKnowledgeRecord inserted = invocation.getArgument(0);
            inserted.setId(30L);
            return 1;
        });
        when(aiProvider.analyzeBookKnowledgeWithMetadata(any()))
            .thenReturn(success(englishAnalyzed(), false));
        when(aiProvider.fallbackBookKnowledge(any())).thenReturn(analyzed());
        when(knowledgeMapper.completeGeneration(any())).thenReturn(1);

        BookKnowledgeBusiness.ResolvedKnowledge resolved = business.ensureKnowledge(
            book, GenerationLocale.KO
        );

        assertThat(resolved.record().getSummary()).isEqualTo("새 분석 요약");
        assertThat(resolved.record().getSummary()).doesNotContain("English provider output");
        assertThat(resolved.record().isFallbackUsed()).isTrue();
        assertThat(resolved.record().getLanguageValidationOutcome())
            .isEqualTo(AiLanguageValidationOutcome.KNOWN_MISMATCH.name());
        assertThat(observed.get()).satisfies(result -> {
            assertThat((BookKnowledgeDto) result.value()).extracting(BookKnowledgeDto::getSummary)
                .isEqualTo(resolved.record().getSummary());
            assertThat(result.outcome()).isEqualTo("FALLBACK");
            assertThat(result.fallbackUsed()).isTrue();
            assertThat(result.failureCategory()).isNull();
            assertThat(result.languageValidationOutcome())
                .isEqualTo(AiLanguageValidationOutcome.KNOWN_MISMATCH);
        });
    }

    @Test
    void strictKnownMismatchIsObservedAsSchemaFailureWithoutBuildingFallback() {
        properties.setRequireProvider(true);
        BookRecord book = book();
        AtomicReference<AiGenerationResult<?>> observed = observeGeneration();
        AtomicReference<BookKnowledgeRecord> inserted = new AtomicReference<>();
        when(knowledgeMapper.findByIdentityAndPromptVersion(
            "isbn", "9781234567890", BookKnowledgeBusiness.PROMPT_VERSION, "ko"
        )).thenReturn(null);
        when(knowledgeMapper.findLatestReadyByIdentity("isbn", "9781234567890", "ko"))
            .thenReturn(null);
        when(knowledgeMapper.insert(any())).thenAnswer(invocation -> {
            BookKnowledgeRecord record = invocation.getArgument(0);
            record.setId(31L);
            inserted.set(record);
            return 1;
        });
        when(aiProvider.analyzeBookKnowledgeWithMetadata(any()))
            .thenReturn(success(englishAnalyzed(), false));
        when(knowledgeMapper.failGeneration(any(), anyString(), anyString(), anyString()))
            .thenReturn(1);

        assertThatThrownBy(() -> business.ensureKnowledge(book, GenerationLocale.KO))
            .isInstanceOf(com.margins.common.error.ApiException.class)
            .extracting(exception -> ((com.margins.common.error.ApiException) exception).getCode())
            .isEqualTo(ApiErrorCode.COMMON_UPSTREAM_ERROR);

        assertThat(observed.get()).satisfies(result -> {
            assertThat(result.value()).isNull();
            assertThat(result.outcome()).isEqualTo("FAILURE");
            assertThat(result.fallbackUsed()).isFalse();
            assertThat(result.failureCategory()).isEqualTo("SCHEMA_VALIDATION");
            assertThat(result.languageValidationOutcome())
                .isEqualTo(AiLanguageValidationOutcome.KNOWN_MISMATCH);
        });
        verify(aiProvider, never()).fallbackBookKnowledge(any());
        verify(knowledgeMapper).failGeneration(
            eq(31L), eq(inserted.get().getGenerationClaimToken()), eq("ko"), anyString()
        );
        verify(knowledgeMapper, never()).completeGeneration(any());
    }

    @Test
    void malformedDiscussionPointFailsExactLocaleClaimWithoutCompletion() {
        BookRecord book = book();
        AtomicReference<AiGenerationResult<?>> observed = observeGeneration();
        AtomicReference<BookKnowledgeRecord> inserted = new AtomicReference<>();
        BookKnowledgeDto malformed = BookKnowledgeDto.builder()
            .summary("유효한 요약")
            .themes(List.of("주제"))
            .discussionPoints(Collections.singletonList(null))
            .recommendedPersonas(List.of())
            .famousQuotes(List.of())
            .keywords(List.of("키워드"))
            .build();
        when(knowledgeMapper.findByIdentityAndPromptVersion(
            "isbn", "9781234567890", BookKnowledgeBusiness.PROMPT_VERSION, "ko"
        )).thenReturn(null);
        when(knowledgeMapper.findLatestReadyByIdentity("isbn", "9781234567890", "ko"))
            .thenReturn(null);
        when(knowledgeMapper.insert(any())).thenAnswer(invocation -> {
            BookKnowledgeRecord record = invocation.getArgument(0);
            record.setId(32L);
            inserted.set(record);
            return 1;
        });
        when(aiProvider.analyzeBookKnowledgeWithMetadata(any()))
            .thenReturn(success(malformed, false));
        when(knowledgeMapper.failGeneration(any(), anyString(), anyString(), anyString()))
            .thenReturn(1);

        assertThatThrownBy(() -> business.ensureKnowledge(book, GenerationLocale.KO))
            .isInstanceOf(com.margins.common.error.ApiException.class)
            .extracting(exception -> ((com.margins.common.error.ApiException) exception).getCode())
            .isEqualTo(ApiErrorCode.COMMON_INTERNAL_ERROR);

        assertThat(observed.get()).satisfies(result -> {
            assertThat(result.value()).isNull();
            assertThat(result.outcome()).isEqualTo("FAILURE");
            assertThat(result.fallbackUsed()).isFalse();
            assertThat(result.failureCategory()).isEqualTo("SCHEMA_VALIDATION");
        });
        verify(knowledgeMapper).failGeneration(
            eq(32L), eq(inserted.get().getGenerationClaimToken()), eq("ko"), anyString()
        );
        verify(knowledgeMapper, never()).completeGeneration(any());
    }

    @Test
    void explicitOwnerPathRevalidatesBookAndResolvesLocaleOnce() {
        BookRecord book = book();
        BookKnowledgeRecord current = ready(
            40L, BookKnowledgeBusiness.PROMPT_VERSION, LocalDateTime.now(), false
        );
        current.setGenerationLocale("en");
        when(bookMapper.findByIdForUser(1L, 7L)).thenReturn(book);
        when(localeResolver.resolve(7L)).thenReturn(GenerationLocale.EN);
        when(knowledgeMapper.findByIdentityAndPromptVersion(
            "isbn", "9781234567890", BookKnowledgeBusiness.PROMPT_VERSION, "en"
        )).thenReturn(current);

        business.ensureForBook(1L, 7L);

        verify(bookMapper).findByIdForUser(1L, 7L);
        verify(localeResolver, times(1)).resolve(7L);
        verify(aiProvider, never()).analyzeBookKnowledgeWithMetadata(any());
    }

    @Test
    void knowledgeOperationalLogsDoNotExposeIdentityClaimOrThrowablePayload() {
        properties.setRequireProvider(true);
        BookRecord book = book();
        String marker = "9781234567890|테스트 책|테스트 저자|book-id-1|claim-token-1|provider-secret";
        when(knowledgeMapper.findByIdentityAndPromptVersion(
            "isbn",
            "9781234567890",
            BookKnowledgeBusiness.PROMPT_VERSION,
            "ko"
        )).thenReturn(null);
        when(knowledgeMapper.insert(any())).thenAnswer(invocation -> {
            BookKnowledgeRecord inserted = invocation.getArgument(0);
            inserted.setId(22L);
            return 1;
        });
        when(aiProvider.analyzeBookKnowledgeWithMetadata(any()))
            .thenThrow(new IllegalStateException(marker));
        when(knowledgeMapper.failGeneration(any(), anyString(), anyString(), anyString())).thenReturn(1);

        Logger logger = (Logger) LoggerFactory.getLogger(BookKnowledgeBusiness.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            assertThatThrownBy(() -> business.ensureKnowledge(book, GenerationLocale.KO))
                .isInstanceOf(com.margins.common.error.ApiException.class);

            assertThat(appender.list)
                .anyMatch(event -> event.getFormattedMessage().contains("outcome=FAILURE"));
            assertThat(appender.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain(
                    "9781234567890", "테스트 책", "테스트 저자", "book-id-1", "claim-token-1", marker
                );
                if (event.getArgumentArray() != null) {
                    assertThat(event.getArgumentArray()).noneMatch(value -> value != null
                        && value.toString().contains("9781234567890|테스트 책|테스트 저자|book-id-1|claim-token-1|provider-secret"));
                }
                assertThat(event.getThrowableProxy()).isNull();
            });
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    private AiGenerationResult<BookKnowledgeDto> success(
        BookKnowledgeDto value,
        boolean fallback
    ) {
        return AiGenerationResult.completed(
            value,
            new AiGenerationTask(
                "BOOK_KNOWLEDGE",
                BookKnowledgeBusiness.PROMPT_VERSION,
                "book-knowledge-schema-v1",
                GenerationLocale.KO
            ),
            fallback ? "placeholder" : "openai",
            fallback ? "placeholder" : "gpt-test",
            AiTokenUsage.NONE,
            10,
            fallback ? "FALLBACK" : "SUCCESS",
            fallback
        );
    }

    private AtomicReference<AiGenerationResult<?>> observeGeneration() {
        AtomicReference<AiGenerationResult<?>> observed = new AtomicReference<>();
        ReflectionTestUtils.setField(
            business,
            "generationObserver",
            (AiGenerationObserver) (result, depth, testData) -> observed.set(result)
        );
        return observed;
    }

    private BookKnowledgeDto analyzed() {
        return BookKnowledgeDto.builder()
            .summary("새 분석 요약")
            .themes(List.of("주제"))
            .discussionPoints(List.of(BookKnowledgeDto.DiscussionPointDto.builder()
                .id("point-1")
                .question("무엇이 달라졌나요?")
                .rationale("변화를 살펴봅니다.")
                .recommendedPersonaKeys(List.of("journalist", "writer"))
                .build()))
            .recommendedPersonas(List.of())
            .famousQuotes(List.of())
            .keywords(List.of("변화"))
            .build();
    }

    private BookKnowledgeDto englishAnalyzed() {
        return BookKnowledgeDto.builder()
            .summary("English provider output contains enough Latin letters to be a known mismatch.")
            .themes(List.of("growth and interpretation"))
            .discussionPoints(List.of(BookKnowledgeDto.DiscussionPointDto.builder()
                .id("point-1")
                .question("Which choice changes the reader's interpretation most clearly?")
                .rationale("This question invites readers to compare evidence and explain their reasoning.")
                .recommendedPersonaKeys(List.of("journalist", "writer"))
                .build()))
            .recommendedPersonas(List.of())
            .famousQuotes(List.of())
            .keywords(List.of("reading discussion perspective"))
            .build();
    }

    private BookRecord book() {
        return BookRecord.builder()
            .id(1L)
            .userId(7L)
            .title("테스트 책")
            .author("테스트 저자")
            .isbn("978-1-2345-6789-0")
            .description("설명")
            .languageCode("ko")
            .testData(true)
            .build();
    }

    private BookKnowledgeRecord ready(
        Long id,
        String promptVersion,
        LocalDateTime generatedAt,
        boolean fallback
    ) {
        return BookKnowledgeRecord.builder()
            .id(id)
            .isbn("9781234567890")
            .titleNormalized("테스트 책")
            .authorNormalized("테스트 저자")
            .lookupKeyType("isbn")
            .lookupKey("9781234567890")
            .title("테스트 책")
            .author("테스트 저자")
            .summary("기존 요약")
            .themesJson("[]")
            .discussionPointsJson(
                "[{\"id\":\"point-1\",\"question\":\"질문\",\"rationale\":\"근거\","
                    + "\"recommendedPersonaKeys\":[]}]"
            )
            .recommendedPersonasJson("[]")
            .famousQuotesJson("[]")
            .keywordsJson("[]")
            .promptVersion(promptVersion)
            .generationLocale("ko")
            .status(BookKnowledgeStatus.READY)
            .fallbackUsed(fallback)
            .testData(true)
            .generatedAt(generatedAt)
            .build();
    }
}
