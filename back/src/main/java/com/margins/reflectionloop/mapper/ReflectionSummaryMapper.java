package com.margins.reflectionloop.mapper;

import com.margins.reflectionloop.model.ReflectionSummaryRecord;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ReflectionSummaryMapper {

    @Select("""
        SELECT id, reflection_insight_id, generation_locale, source_hash, summary, model,
               token_usage_json, language_validation_outcome, is_test_data, created_at, updated_at
        FROM reflection_summaries
        WHERE reflection_insight_id = #{reflectionInsightId}
          AND generation_locale = #{generationLocale}
          AND source_hash = #{sourceHash}
        """)
    ReflectionSummaryRecord findByIdentity(
        @Param("reflectionInsightId") Long reflectionInsightId,
        @Param("generationLocale") String generationLocale,
        @Param("sourceHash") String sourceHash
    );

    @Insert("""
        INSERT INTO reflection_summaries (
          reflection_insight_id, generation_locale, source_hash, summary, model,
          token_usage_json, language_validation_outcome, is_test_data
        ) VALUES (
          #{reflectionInsightId}, #{generationLocale}, #{sourceHash}, #{summary}, #{model},
          #{tokenUsageJson}, #{languageValidationOutcome}, #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(ReflectionSummaryRecord record);
}
