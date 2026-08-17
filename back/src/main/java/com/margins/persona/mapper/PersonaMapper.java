package com.margins.persona.mapper;

import com.margins.persona.model.PersonaRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

/**
 * 페르소나 테이블에 접근하는 MyBatis 매퍼다.
 * 사용자별 페르소나 생성, 조회, 기본값 확인 쿼리를 담당한다.
 */
@Mapper
public interface PersonaMapper {

    @Insert("""
        INSERT INTO personas (
          name,
          display_name,
          description,
          system_prompt,
          tone,
          created_by_user_id,
          is_shared,
          is_active,
          is_test_data
        )
        VALUES (
          #{name},
          #{displayName},
          #{description},
          #{systemPrompt},
          #{tone},
          #{createdByUserId},
          FALSE,
          #{active},
          TRUE
        )
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(PersonaRecord record);

    @Select("""
        SELECT
          id,
          name,
          display_name,
          description,
          system_prompt,
          tone,
          is_active,
          is_shared
        FROM personas
        WHERE is_active = TRUE
          AND deleted_at IS NULL
          AND is_shared = TRUE
        ORDER BY id ASC
        """)
    List<PersonaRecord> findActive();

    @Select("""
        SELECT id, name, display_name, description, system_prompt, tone, is_active,
               created_by_user_id, is_shared
        FROM personas
        WHERE is_active = TRUE
          AND deleted_at IS NULL
          AND (is_shared = TRUE OR created_by_user_id = #{userId})
        ORDER BY id ASC
        """)
    List<PersonaRecord> findActiveForUser(Long userId);

    @Select("""
        SELECT
          id,
          name,
          display_name,
          description,
          system_prompt,
          tone,
          is_active,
          is_shared
        FROM personas
        WHERE id = #{id}
          AND is_active = TRUE
          AND deleted_at IS NULL
          AND is_shared = TRUE
        """)
    PersonaRecord findActiveById(Long id);

    @Select("""
        SELECT id, name, display_name, description, system_prompt, tone, is_active,
               created_by_user_id, is_shared
        FROM personas
        WHERE id = #{id}
          AND is_active = TRUE
          AND deleted_at IS NULL
          AND (is_shared = TRUE OR created_by_user_id = #{userId})
        """)
    PersonaRecord findActiveByIdForUser(Long id, Long userId);
}
