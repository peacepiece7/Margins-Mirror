package com.margins.ai.mapper;

import com.margins.ai.model.AiGenerationEventRecord;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;

@Mapper
public interface AiGenerationEventMapper {
    @Insert("""
        INSERT INTO ai_generation_events (
          request_id, correlation_id, task_type, depth, provider, model, prompt_version,
          schema_version, input_tokens, cached_input_tokens, output_tokens,
          latency_ms, outcome, fallback_used, failure_category,
          generation_locale, language_validation_outcome, is_test_data
        ) VALUES (
          #{requestId}, #{correlationId}, #{taskType}, #{depth}, #{provider}, #{model}, #{promptVersion},
          #{schemaVersion}, #{inputTokens}, #{cachedInputTokens}, #{outputTokens},
          #{latencyMs}, #{outcome}, #{fallbackUsed}, #{failureCategory},
          #{generationLocale}, #{languageValidationOutcome}, #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(AiGenerationEventRecord record);
}
