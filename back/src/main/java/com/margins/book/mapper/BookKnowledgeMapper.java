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
          AND status = 'ready'
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
        """)
    BookKnowledgeRecord findReadyByIsbn(String isbn);

    @Select("""
        SELECT
        """ + COLUMNS + """
        FROM book_knowledge
        WHERE title_normalized = #{titleNormalized}
          AND author_normalized = #{authorNormalized}
          AND status = 'ready'
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
        """)
    BookKnowledgeRecord findReadyByTitleAuthor(
        @Param("titleNormalized") String titleNormalized,
        @Param("authorNormalized") String authorNormalized
    );

    @Select("""
        SELECT
        """ + COLUMNS + """
        FROM book_knowledge
        WHERE lookup_key_type = #{lookupKeyType}
          AND lookup_key = #{lookupKey}
          AND prompt_version = #{promptVersion}
        ORDER BY id DESC
        LIMIT 1
        """)
    BookKnowledgeRecord findByIdentityAndPromptVersion(
        @Param("lookupKeyType") String lookupKeyType,
        @Param("lookupKey") String lookupKey,
        @Param("promptVersion") String promptVersion
    );

    @Select("""
        SELECT
        """ + COLUMNS + """
        FROM book_knowledge
        WHERE lookup_key_type = #{lookupKeyType}
          AND lookup_key = #{lookupKey}
          AND status = 'ready'
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
        """)
    BookKnowledgeRecord findLatestReadyByIdentity(
        @Param("lookupKeyType") String lookupKeyType,
        @Param("lookupKey") String lookupKey
    );

    @Select("""
        SELECT
        """ + COLUMNS + """
        FROM book_knowledge
        WHERE lookup_key_type = #{lookupKeyType}
          AND lookup_key = #{lookupKey}
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
        @Param("maxAgeDays") int maxAgeDays
    );

    @Select("""
        SELECT EXISTS(
          SELECT 1
          FROM book_knowledge
          WHERE id = #{knowledgeId}
            AND generation_claim_token IS NOT NULL
            AND generation_claimed_at IS NOT NULL
            AND generation_claimed_at
              >= CURRENT_TIMESTAMP(6) - INTERVAL #{claimTtlSeconds} SECOND
        )
        """)
    boolean hasActiveGenerationClaim(
        @Param("knowledgeId") Long knowledgeId,
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
            status = 'ready',
            fallback_used = #{fallbackUsed},
            failure_reason = NULL,
            generated_at = #{generatedAt},
            generation_claim_token = NULL,
            generation_claimed_at = NULL
        WHERE id = #{id}
          AND generation_claim_token = #{generationClaimToken}
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
        """)
    int failGeneration(
        @Param("knowledgeId") Long knowledgeId,
        @Param("claimToken") String claimToken,
        @Param("failureReason") String failureReason
    );
}
