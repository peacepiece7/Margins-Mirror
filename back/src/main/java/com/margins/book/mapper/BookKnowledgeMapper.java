package com.margins.book.mapper;

import com.margins.book.model.BookKnowledgeRecord;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface BookKnowledgeMapper {
    String COLUMNS = """
        id,
        isbn,
        title_normalized AS titleNormalized,
        author_normalized AS authorNormalized,
        lookup_key_type AS lookupKeyType,
        lookup_key AS lookupKey,
        title,
        author,
        summary,
        themes_json AS themesJson,
        discussion_points_json AS discussionPointsJson,
        recommended_personas_json AS recommendedPersonasJson,
        famous_quotes_json AS famousQuotesJson,
        keywords_json AS keywordsJson,
        prompt_version AS promptVersion,
        generation_locale AS generationLocale,
        language_validation_outcome AS languageValidationOutcome,
        status,
        fallback_used AS fallbackUsed,
        is_test_data AS testData,
        failure_reason AS failureReason,
        generation_claim_token AS generationClaimToken,
        generation_claimed_at AS generationClaimedAt,
        generated_at AS generatedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
        """;

    @Select("""
        SELECT
        """ + COLUMNS + """
        FROM book_knowledge
        WHERE isbn = #{isbn}
          AND generation_locale = #{generationLocale}
          AND status = 'ready'
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
        """)
    BookKnowledgeRecord findReadyByIsbn(
        @Param("isbn") String isbn,
        @Param("generationLocale") String generationLocale
    );

    @Select("""
        SELECT
        """ + COLUMNS + """
        FROM book_knowledge
        WHERE title_normalized = #{titleNormalized}
          AND author_normalized = #{authorNormalized}
          AND generation_locale = #{generationLocale}
          AND status = 'ready'
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
        """)
    BookKnowledgeRecord findReadyByTitleAuthor(
        @Param("titleNormalized") String titleNormalized,
        @Param("authorNormalized") String authorNormalized,
        @Param("generationLocale") String generationLocale
    );

    @Select("""
        SELECT
        """ + COLUMNS + """
        FROM book_knowledge
        WHERE lookup_key_type = #{lookupKeyType}
          AND lookup_key = #{lookupKey}
          AND prompt_version = #{promptVersion}
          AND generation_locale = #{generationLocale}
        ORDER BY id DESC
        LIMIT 1
        """)
    BookKnowledgeRecord findByIdentityAndPromptVersion(
        @Param("lookupKeyType") String lookupKeyType,
        @Param("lookupKey") String lookupKey,
        @Param("promptVersion") String promptVersion,
        @Param("generationLocale") String generationLocale
    );

    @Select("""
        SELECT
        """ + COLUMNS + """
        FROM book_knowledge
        WHERE lookup_key_type = #{lookupKeyType}
          AND lookup_key = #{lookupKey}
          AND generation_locale = #{generationLocale}
          AND status = 'ready'
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
        """)
    BookKnowledgeRecord findLatestReadyByIdentity(
        @Param("lookupKeyType") String lookupKeyType,
        @Param("lookupKey") String lookupKey,
        @Param("generationLocale") String generationLocale
    );

    @Select("""
        SELECT
        """ + COLUMNS + """
        FROM book_knowledge
        WHERE lookup_key_type = #{lookupKeyType}
          AND lookup_key = #{lookupKey}
          AND generation_locale = #{generationLocale}
          AND status = 'ready'
          AND generated_at
            >= CURRENT_TIMESTAMP(6) - INTERVAL #{maxAgeDays} DAY
        ORDER BY
          CASE WHEN prompt_version = #{preferredPromptVersion} THEN 0 ELSE 1 END,
          generated_at DESC,
          id DESC
        LIMIT 1
        """)
    BookKnowledgeRecord findReusableReadyByIdentity(
        @Param("lookupKeyType") String lookupKeyType,
        @Param("lookupKey") String lookupKey,
        @Param("preferredPromptVersion") String preferredPromptVersion,
        @Param("generationLocale") String generationLocale,
        @Param("maxAgeDays") int maxAgeDays
    );

    @Select("""
        SELECT EXISTS(
          SELECT 1
          FROM book_knowledge
          WHERE id = #{knowledgeId}
            AND generation_locale = #{generationLocale}
            AND generation_claim_token IS NOT NULL
            AND generation_claimed_at IS NOT NULL
            AND generation_claimed_at
              >= CURRENT_TIMESTAMP(6) - INTERVAL #{claimTtlSeconds} SECOND
        )
        """)
    boolean hasActiveGenerationClaim(
        @Param("knowledgeId") Long knowledgeId,
        @Param("generationLocale") String generationLocale,
        @Param("claimTtlSeconds") int claimTtlSeconds
    );

    @Insert("""
        INSERT INTO book_knowledge (
          isbn,
          title_normalized,
          author_normalized,
          lookup_key_type,
          lookup_key,
          title,
          author,
          summary,
          themes_json,
          discussion_points_json,
          recommended_personas_json,
          famous_quotes_json,
          keywords_json,
          prompt_version,
          generation_locale,
          language_validation_outcome,
          status,
          fallback_used,
          is_test_data,
          failure_reason,
          generation_claim_token,
          generation_claimed_at,
          generated_at
        ) VALUES (
          #{isbn},
          #{titleNormalized},
          #{authorNormalized},
          #{lookupKeyType},
          #{lookupKey},
          #{title},
          #{author},
          #{summary},
          #{themesJson},
          #{discussionPointsJson},
          #{recommendedPersonasJson},
          #{famousQuotesJson},
          #{keywordsJson},
          #{promptVersion},
          #{generationLocale},
          #{languageValidationOutcome},
          #{status},
          #{fallbackUsed},
          #{testData},
          #{failureReason},
          #{generationClaimToken},
          #{generationClaimedAt},
          #{generatedAt}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(BookKnowledgeRecord record);

    @Update("""
        UPDATE book_knowledge
        SET generation_claim_token = #{claimToken},
            generation_claimed_at = CURRENT_TIMESTAMP(6),
            status = CASE WHEN status = 'ready' THEN status ELSE 'pending' END,
            failure_reason = NULL
        WHERE id = #{knowledgeId}
          AND generation_locale = #{generationLocale}
          AND (
            generation_claim_token IS NULL
            OR generation_claimed_at IS NULL
            OR generation_claimed_at
              < CURRENT_TIMESTAMP(6) - INTERVAL #{claimTtlSeconds} SECOND
          )
        """)
    int claimGeneration(
        @Param("knowledgeId") Long knowledgeId,
        @Param("claimToken") String claimToken,
        @Param("generationLocale") String generationLocale,
        @Param("claimTtlSeconds") int claimTtlSeconds
    );

    @Update("""
        UPDATE book_knowledge
        SET title = #{title},
            author = #{author},
            summary = #{summary},
            themes_json = #{themesJson},
            discussion_points_json = #{discussionPointsJson},
            recommended_personas_json = #{recommendedPersonasJson},
            famous_quotes_json = #{famousQuotesJson},
            keywords_json = #{keywordsJson},
            language_validation_outcome = #{languageValidationOutcome},
            status = 'ready',
            fallback_used = #{fallbackUsed},
            failure_reason = NULL,
            generated_at = #{generatedAt},
            generation_claim_token = NULL,
            generation_claimed_at = NULL
        WHERE id = #{id}
          AND generation_claim_token = #{generationClaimToken}
          AND generation_locale = #{generationLocale}
        """)
    int completeGeneration(BookKnowledgeRecord record);

    @Update("""
        UPDATE book_knowledge
        SET status = CASE WHEN status = 'ready' THEN status ELSE 'failed' END,
            failure_reason = #{failureReason},
            generation_claim_token = NULL,
            generation_claimed_at = NULL
        WHERE id = #{knowledgeId}
          AND generation_claim_token = #{claimToken}
          AND generation_locale = #{generationLocale}
        """)
    int failGeneration(
        @Param("knowledgeId") Long knowledgeId,
        @Param("claimToken") String claimToken,
        @Param("generationLocale") String generationLocale,
        @Param("failureReason") String failureReason
    );
}
