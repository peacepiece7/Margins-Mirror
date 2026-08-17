package com.margins.reflectionloop.mapper;

import com.margins.question.model.QuestionRecord;
import com.margins.reflectionloop.model.ReflectionInterviewAnswerRecord;
import com.margins.reflectionloop.model.ReflectionInterviewRecord;
import com.margins.session.model.SessionInsightRecord;
import com.margins.session.model.SessionWindowRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ReflectionInterviewMapper {

    @Select("""
        SELECT id, session_id, user_id, source_question_id, window_type, title,
               position, status, is_test_data
        FROM session_windows
        WHERE session_id = #{sessionId}
          AND user_id = #{userId}
          AND window_type = #{windowType}
          AND deleted_at IS NULL
        ORDER BY id ASC
        LIMIT 1
        """)
    SessionWindowRecord findActiveWindowBySessionAndType(
        @Param("sessionId") Long sessionId,
        @Param("userId") Long userId,
        @Param("windowType") String windowType
    );

    @Select("""
        SELECT id, reflection_insight_id, source_revision_id, session_id, window_id, user_id,
               parent_interview_id, fork_question_id,
               status, coverage_json, answered_count, skipped_count, generated_count,
               prompt_version, is_test_data, created_at, updated_at, completed_at
        FROM reflection_interviews
        WHERE source_revision_id = #{revisionId}
          AND user_id = #{userId}
          AND status IN ('ACTIVE', 'GUIDE_READY')
        ORDER BY id DESC
        LIMIT 1
        """)
    ReflectionInterviewRecord findActiveInterviewByRevision(
        @Param("revisionId") Long revisionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id, reflection_insight_id, source_revision_id, session_id, window_id, user_id,
               parent_interview_id, fork_question_id,
               status, coverage_json, answered_count, skipped_count, generated_count,
               prompt_version, is_test_data, created_at, updated_at, completed_at
        FROM reflection_interviews
        WHERE id = #{interviewId}
          AND user_id = #{userId}
        """)
    ReflectionInterviewRecord findOwnedInterview(
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id
        FROM reflection_interviews
        WHERE id = #{interviewId}
          AND user_id = #{userId}
        FOR UPDATE
        """)
    Long lockOwnedInterview(
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Insert("""
        INSERT INTO reflection_interviews (
          reflection_insight_id, source_revision_id, session_id, window_id, user_id,
          parent_interview_id, fork_question_id,
          status, coverage_json, answered_count, skipped_count, generated_count,
          prompt_version, is_test_data
        ) VALUES (
          #{reflectionInsightId}, #{sourceRevisionId}, #{sessionId}, #{windowId}, #{userId},
          #{parentInterviewId}, #{forkQuestionId},
          #{status}, CAST(#{coverageJson} AS JSON), #{answeredCount}, #{skippedCount},
          #{generatedCount}, #{promptVersion}, #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertInterview(ReflectionInterviewRecord record);

    @Update("""
        UPDATE reflection_interviews
        SET status = #{status},
            coverage_json = CAST(#{coverageJson} AS JSON),
            answered_count = #{answeredCount},
            skipped_count = #{skippedCount},
            generated_count = #{generatedCount},
            completed_at = CASE WHEN #{status} = 'COMPLETED' THEN CURRENT_TIMESTAMP(6) ELSE completed_at END
        WHERE id = #{id}
          AND user_id = #{userId}
        """)
    int updateInterview(ReflectionInterviewRecord record);

    @Select("""
        SELECT id, session_id, window_id, user_id, reflection_interview_id,
               question_text, question_type, coverage_area, response_mode, source_type,
               source_ref_id, source_excerpt, source_version, source_stale, source_fallback,
               sensitivity, status, ai_model, is_test_data
        FROM questions
        WHERE reflection_interview_id = #{interviewId}
          AND user_id = #{userId}
          AND status = 'active'
          AND deleted_at IS NULL
        ORDER BY id ASC
        LIMIT 1
        """)
    QuestionRecord findCurrentInterviewQuestion(
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id, session_id, window_id, user_id, reflection_interview_id,
               question_text, question_type, coverage_area, response_mode, source_type,
               source_ref_id, source_excerpt, source_version, source_stale, source_fallback,
               sensitivity, status, ai_model, is_test_data
        FROM questions
        WHERE reflection_interview_id = #{interviewId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        ORDER BY id ASC
        """)
    List<QuestionRecord> findInterviewQuestions(
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT id, session_id, window_id, user_id, reflection_interview_id,
               question_text, question_type, coverage_area, response_mode, source_type,
               source_ref_id, source_excerpt, source_version, source_stale, source_fallback,
               sensitivity, status, ai_model, is_test_data
        FROM questions
        WHERE id = #{questionId}
          AND reflection_interview_id = #{interviewId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    QuestionRecord findOwnedInterviewQuestion(
        @Param("interviewId") Long interviewId,
        @Param("questionId") Long questionId,
        @Param("userId") Long userId
    );

    @Update("""
        UPDATE questions
        SET status = #{status},
            response_mode = #{responseMode},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = #{questionId}
          AND reflection_interview_id = #{interviewId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int resolveInterviewQuestion(
        @Param("interviewId") Long interviewId,
        @Param("questionId") Long questionId,
        @Param("userId") Long userId,
        @Param("status") String status,
        @Param("responseMode") String responseMode
    );

    @Update("""
        UPDATE questions
        SET status = 'active',
            response_mode = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (
          SELECT reopen_id
          FROM (
            SELECT id AS reopen_id
            FROM questions
            WHERE reflection_interview_id = #{interviewId}
              AND user_id = #{userId}
              AND status IN ('skipped', 'replaced')
              AND deleted_at IS NULL
            ORDER BY id ASC
            LIMIT 1
          ) candidate
        )
        """)
    int reopenFirstSkippedQuestion(
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT q.id, q.session_id, q.window_id, q.user_id, q.reflection_interview_id,
               q.question_text, q.question_type, q.coverage_area, q.response_mode,
               q.source_type, q.source_ref_id, q.source_excerpt, q.source_version,
               q.source_stale, q.source_fallback, q.sensitivity,
               q.status, q.ai_model, q.is_test_data
        FROM questions q
        WHERE q.reflection_interview_id = #{interviewId}
          AND q.user_id = #{userId}
          AND q.status = 'answered'
          AND q.deleted_at IS NULL
        ORDER BY q.id ASC
        """)
    List<QuestionRecord> findAnsweredInterviewQuestions(
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT si.content
        FROM session_insights si
        WHERE si.question_id = #{questionId}
          AND si.user_id = #{userId}
          AND si.insight_type = 'question_answer'
          AND si.deleted_at IS NULL
        LIMIT 1
        """)
    String findQuestionAnswer(
        @Param("questionId") Long questionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT si.id, si.session_id, si.user_id, si.question_id, si.insight_type,
               si.title, si.content, si.evidence, si.author_name, si.visibility,
               si.reviewed_on, si.insight_order, si.created_at, si.updated_at, si.is_test_data
        FROM session_insights si
        WHERE si.question_id = #{questionId}
          AND si.user_id = #{userId}
          AND si.insight_type = 'question_answer'
          AND si.deleted_at IS NULL
        LIMIT 1
        """)
    SessionInsightRecord findQuestionAnswerInsight(
        @Param("questionId") Long questionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT ar.id, ar.interview_id, ar.question_id, ar.session_insight_id, ar.user_id,
               ar.version, ar.content, ar.response_mode, ar.revision_kind,
               ar.source_answer_revision_id, ar.is_current AS current,
               ar.is_test_data, ar.created_at, q.question_text
        FROM reflection_interview_answer_revisions ar
        INNER JOIN questions q ON q.id = ar.question_id
        WHERE ar.interview_id = #{interviewId}
          AND ar.question_id = #{questionId}
          AND ar.user_id = #{userId}
          AND ar.is_current = TRUE
          AND q.user_id = #{userId}
          AND q.deleted_at IS NULL
        LIMIT 1
        """)
    ReflectionInterviewAnswerRecord findCurrentAnswer(
        @Param("interviewId") Long interviewId,
        @Param("questionId") Long questionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT ar.id, ar.interview_id, ar.question_id, ar.session_insight_id, ar.user_id,
               ar.version, ar.content, ar.response_mode, ar.revision_kind,
               ar.source_answer_revision_id, ar.is_current AS current,
               ar.is_test_data, ar.created_at, q.question_text
        FROM reflection_interview_answer_revisions ar
        INNER JOIN questions q ON q.id = ar.question_id
        WHERE ar.interview_id = #{interviewId}
          AND ar.user_id = #{userId}
          AND ar.is_current = TRUE
          AND q.user_id = #{userId}
          AND q.deleted_at IS NULL
        ORDER BY q.id ASC
        """)
    List<ReflectionInterviewAnswerRecord> findCurrentAnswers(
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT ar.id, ar.interview_id, ar.question_id, ar.session_insight_id, ar.user_id,
               ar.version, ar.content, ar.response_mode, ar.revision_kind,
               ar.source_answer_revision_id, ar.is_current AS current,
               ar.is_test_data, ar.created_at, q.question_text
        FROM reflection_interview_answer_revisions ar
        INNER JOIN questions q ON q.id = ar.question_id
        WHERE ar.interview_id = #{interviewId}
          AND ar.question_id = #{questionId}
          AND ar.user_id = #{userId}
          AND ar.is_current = TRUE
          AND q.user_id = #{userId}
          AND q.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        """)
    ReflectionInterviewAnswerRecord findCurrentAnswerForUpdate(
        @Param("interviewId") Long interviewId,
        @Param("questionId") Long questionId,
        @Param("userId") Long userId
    );

    @Select("""
        SELECT COALESCE(MAX(version), 0) + 1
        FROM reflection_interview_answer_revisions
        WHERE interview_id = #{interviewId}
          AND question_id = #{questionId}
        """)
    int nextAnswerVersion(
        @Param("interviewId") Long interviewId,
        @Param("questionId") Long questionId
    );

    @Update("""
        UPDATE reflection_interview_answer_revisions
        SET is_current = FALSE
        WHERE id = #{answerRevisionId}
          AND interview_id = #{interviewId}
          AND user_id = #{userId}
          AND is_current = TRUE
        """)
    int archiveCurrentAnswer(
        @Param("answerRevisionId") Long answerRevisionId,
        @Param("interviewId") Long interviewId,
        @Param("userId") Long userId
    );

    @Insert("""
        INSERT INTO reflection_interview_answer_revisions (
          interview_id, question_id, session_insight_id, user_id, version,
          content, response_mode, revision_kind, source_answer_revision_id,
          is_current, is_test_data
        ) VALUES (
          #{interviewId}, #{questionId}, #{sessionInsightId}, #{userId}, #{version},
          #{content}, #{responseMode}, #{revisionKind}, #{sourceAnswerRevisionId},
          #{current}, #{testData}
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertAnswerRevision(ReflectionInterviewAnswerRecord record);
}
