package com.margins.reflectionloop.mapper;

import com.margins.reflectionloop.model.DiscussionRunRefinementRecord;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface DiscussionRunRefinementMapper {

    @Select("""
        SELECT id, run_id, generation_locale, input_hash, transcript_hash, prompt_version,
               status, suggestion_content, generation_metadata_json, language_validation_outcome,
               is_test_data, generated_at, created_at, updated_at
        FROM discussion_run_refinements
        WHERE run_id = #{runId}
          AND generation_locale = #{generationLocale}
          AND input_hash = #{inputHash}
        """)
    DiscussionRunRefinementRecord findByIdentity(
        @Param("runId") Long runId,
        @Param("generationLocale") String generationLocale,
        @Param("inputHash") String inputHash
    );

    @Insert("""
        INSERT INTO discussion_run_refinements (
          run_id, generation_locale, input_hash, transcript_hash, prompt_version,
          status, is_test_data
        ) VALUES (
          #{runId}, #{generationLocale}, #{inputHash}, #{transcriptHash}, #{promptVersion},
          'PENDING', #{testData}
        )
        """)
    int insertPending(DiscussionRunRefinementRecord record);

    @Update("""
        UPDATE discussion_run_refinements
        SET status = #{status},
            suggestion_content = #{suggestionContent},
            generation_metadata_json = #{generationMetadataJson},
            language_validation_outcome = #{languageValidationOutcome},
            generated_at = CURRENT_TIMESTAMP(6)
        WHERE id = #{id}
          AND run_id = #{runId}
          AND generation_locale = #{generationLocale}
          AND status = 'PENDING'
        """)
    int finalize(DiscussionRunRefinementRecord record);
}
