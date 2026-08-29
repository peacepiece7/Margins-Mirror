package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.ai.AiProvider;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class BackendBoundaryArchitectureTest {

    private static final Path MAIN = Path.of("src", "main", "java", "com", "margins");

    @Test
    void aiProviderExposesOnlyLocaleBearingApisForPr1GenerationPaths() {
        Set<String> publicMethods = Stream.of(AiProvider.class.getMethods())
            .map(java.lang.reflect.Method::getName)
            .collect(Collectors.toSet());

        assertThat(publicMethods).doesNotContain(
            "suggestQuestions",
            "answerWindowMessage",
            "streamWindowMessage",
            "answerDebateMessage",
            "answerDebateMessages"
        );
        assertThat(publicMethods).contains(
            "suggestQuestionsWithMetadata",
            "answerWindowMessageWithMetadata",
            "streamWindowMessageWithMetadata",
            "answerDebateMessageWithMetadata",
            "answerDebateMessagesWithMetadata"
        );
    }

    @Test
    void onlyResponsesTransportOwnsOpenAiHttpProtocol() throws IOException {
        String transport = source("ai/transport/OpenAiResponsesTransport.java");
        String provider = source("ai/OpenAiAiProvider.java");
        String guideClient = source("ai/provider/OpenAiDiscussionGuideClient.java");
        String moderator = source("moderation/OpenAiDiscussionModerator.java");

        assertThat(transport)
            .contains("java.net.http.HttpClient")
            .contains("java.net.http.HttpRequest")
            .contains("java.net.http.HttpResponse")
            .contains("AiTokenUsage.fromOpenAi");
        assertThat(provider)
            .contains("OpenAiResponsesTransport")
            .doesNotContain("java.net.http")
            .doesNotContain("HttpClient");
        assertThat(guideClient)
            .contains("OpenAiResponsesTransport")
            .doesNotContain("java.net.http")
            .doesNotContain("HttpClient");
        assertThat(moderator)
            .contains("OpenAiResponsesTransport")
            .doesNotContain("java.net.http")
            .doesNotContain("HttpRequest")
            .doesNotContain("HttpResponse");
    }

    @Test
    void discussionGuidePolicyIsIsolatedBehindProviderFacade() throws IOException {
        String provider = source("ai/OpenAiAiProvider.java");
        String guideClient = source("ai/provider/OpenAiDiscussionGuideClient.java");

        assertThat(provider)
            .contains(
                "OpenAiDiscussionGuideClient",
                "discussionGuideClient.generate(",
                "discussionGuideClient.generateWithMetadata("
            )
            .doesNotContain(
                "Create one evidence-grounded reading discussion guide in the required response language.",
                "discussionGuideTextFormat",
                "GuideProviderFailure"
            );
        assertThat(guideClient)
            .contains(
                "Create one evidence-grounded reading discussion guide in the required response language.",
                "discussionGuideTextFormat",
                "GuideProviderFailure",
                "OpenAiResponsesTransport"
            )
            .doesNotContain(
                "Create one evidence-grounded Korean reading discussion guide.",
                "SessionWindowMapper",
                "MessageMapper",
                "QuestionMapper",
                "PersonaMapper",
                "BookKnowledgeMapper"
            );
    }

    @Test
    void reflectionPersistenceIncludesLocaleCacheMappers() throws IOException {
        Path mapperDirectory = MAIN.resolve("reflectionloop/mapper");
        try (Stream<Path> files = Files.list(mapperDirectory)) {
            Set<String> mapperFiles = files
                .map(path -> path.getFileName().toString())
                .collect(Collectors.toSet());

            assertThat(mapperFiles).containsExactlyInAnyOrder(
                "ReflectionRevisionMapper.java",
                "ReflectionInterviewMapper.java",
                "DiscussionGuideMapper.java",
                "DiscussionRunMapper.java",
                "ReflectionSummaryMapper.java",
                "DiscussionRunRefinementMapper.java"
            );
        }

        assertThat(source("reflectionloop/mapper/ReflectionRevisionMapper.java"))
            .contains("insertRevision", "updateReflectionProjection")
            .doesNotContain("insertInterview", "insertGuide", "insertRun");
        assertThat(source("reflectionloop/mapper/ReflectionInterviewMapper.java"))
            .contains("insertInterview", "findInterviewQuestions")
            .doesNotContain("insertRevision", "insertGuide", "insertRun");
        assertThat(source("reflectionloop/mapper/DiscussionGuideMapper.java"))
            .contains("insertGuide", "insertGuideItem")
            .doesNotContain("insertRevision", "insertInterview", "insertRun");
        assertThat(source("reflectionloop/mapper/DiscussionRunMapper.java"))
            .contains("insertRun", "findOwnedDiscussionTranscript")
            .doesNotContain("insertRevision", "insertInterview", "insertGuide(");
        assertThat(source("reflectionloop/mapper/ReflectionSummaryMapper.java"))
            .contains("findByIdentity", "reflection_summaries")
            .doesNotContain("discussion_run_refinements");
        assertThat(source("reflectionloop/mapper/DiscussionRunRefinementMapper.java"))
            .contains("findByIdentity", "discussion_run_refinements")
            .doesNotContain("reflection_summaries");
    }

    @Test
    void reflectionBusinessesDeclareOnlyRequiredAggregateDependencies() throws IOException {
        assertThat(source("reflectionloop/business/ReflectionBusiness.java"))
            .contains(
                "ReflectionRevisionMapper",
                "ReflectionInterviewMapper",
                "DiscussionGuideMapper",
                "DiscussionRunMapper"
            )
            .doesNotContain("ReflectionLoopMapper");
        assertThat(source("reflectionloop/business/ReflectionInterviewBusiness.java"))
            .contains(
                "ReflectionRevisionMapper",
                "ReflectionInterviewMapper",
                "DiscussionGuideMapper"
            )
            .doesNotContain("DiscussionRunMapper", "ReflectionLoopMapper");
        assertThat(source("reflectionloop/business/DiscussionGuideBusiness.java"))
            .contains(
                "ReflectionRevisionMapper",
                "DiscussionGuideMapper",
                "DiscussionRunMapper",
                "DiscussionGuideVersionPolicy",
                "DiscussionGuideVersionWriter"
            )
            .doesNotContain(
                "ReflectionInterviewMapper",
                "QuestionMapper",
                "ReflectionLoopMapper"
            );
        assertThat(source("reflectionloop/business/DiscussionRunBusiness.java"))
            .contains(
                "ReflectionRevisionMapper",
                "DiscussionGuideMapper",
                "DiscussionRunMapper"
            )
            .doesNotContain("ReflectionInterviewMapper", "ReflectionLoopMapper");
    }

    @Test
    void discussionGuideVersionPolicyAndWriterHaveDirectionalDependencies() throws IOException {
        String business = source("reflectionloop/business/DiscussionGuideBusiness.java");
        String policy = source("reflectionloop/business/DiscussionGuideVersionPolicy.java");
        String writer = source("reflectionloop/business/DiscussionGuideVersionWriter.java");

        assertThat(business)
            .contains(
                "TransactionTemplate",
                "guideGenerator.generate(",
                "versionPolicy.editedContent(",
                "versionWriter.replaceCurrent("
            )
            .doesNotContain(
                "insertGuide(",
                "insertGuideItem(",
                "archiveCurrentGuide(",
                "Guide edit item identity is invalid"
            );
        assertThat(policy)
            .contains(
                "Guide edit item identity is invalid",
                "Guide required stages are out of order",
                "Guide item minutes must equal the target minutes"
            )
            .doesNotContain(
                "Mapper",
                "ObjectMapper",
                "AuthContext",
                "TransactionTemplate"
            );
        assertThat(writer)
            .contains(
                "DiscussionGuideMapper",
                "ReflectionInterviewMapper",
                "QuestionMapper",
                "archiveCurrentGuide(",
                "insertGuide(",
                "insertGuideItem("
            )
            .doesNotContain(
                "ReflectionRevisionMapper",
                "DiscussionRunMapper",
                "ReflectionEvidenceCatalog",
                "TransactionTemplate",
                "AuthContext"
            );
    }

    @Test
    void reflectionTransportDtosAreTopLevelAndDirectional() throws IOException {
        Path requestDirectory = MAIN.resolve("reflectionloop/model/dto/request");
        Path responseDirectory = MAIN.resolve("reflectionloop/model/dto/response");

        assertThat(Files.exists(MAIN.resolve("reflectionloop/dto/ReflectionLoopDtos.java")))
            .isFalse();
        assertThat(javaFiles(requestDirectory))
            .allMatch(name -> name.endsWith("Request.java") || name.endsWith("RequestParams.java"));
        assertThat(javaFiles(responseDirectory))
            .allMatch(name -> name.endsWith("Response.java") || name.endsWith("Dto.java")
                || name.equals("DiscussionGuideVersionSummary.java"));
        assertThat(javaFiles(MAIN.resolve("reflectionloop/model/enums")))
            .containsExactly("DiscussionGuideProjection.java");

        assertOneTopLevelTypePerFile(requestDirectory);
        assertOneTopLevelTypePerFile(responseDirectory);
        assertOneTopLevelTypePerFile(MAIN.resolve("reflectionloop/model/enums"));
    }

    private Set<String> javaFiles(Path directory) throws IOException {
        try (Stream<Path> files = Files.list(directory)) {
            return files
                .filter(path -> path.getFileName().toString().endsWith(".java"))
                .map(path -> path.getFileName().toString())
                .collect(Collectors.toSet());
        }
    }

    private void assertOneTopLevelTypePerFile(Path directory) throws IOException {
        for (String file : javaFiles(directory)) {
            String typeName = file.substring(0, file.length() - ".java".length());
            String contents = Files.readString(directory.resolve(file));
            Pattern declaration = Pattern.compile(
                "public\\s+(?:sealed\\s+)?(?:final\\s+)?(?:class|interface|enum)\\s+"
                    + Pattern.quote(typeName)
                    + "\\b"
            );

            assertThat(declaration.matcher(contents).results().count())
                .as(file)
                .isEqualTo(1);
        }
    }

    private String source(String relativePath) throws IOException {
        return Files.readString(MAIN.resolve(relativePath));
    }
}
