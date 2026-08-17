package com.margins.memorycard.mapper;

import com.margins.memorycard.model.MemoryCardGroupRecord;
import com.margins.memorycard.model.MemoryCardRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface MemoryCardMapper {

    String GROUP_COLUMNS = """
        id,
        user_id AS userId,
        title,
        description,
        source_label AS sourceLabel,
        NULL AS cardCount,
        is_test_data AS testData,
        created_at AS createdAt,
        updated_at AS updatedAt
        """;

    String CARD_COLUMNS = """
        id,
        group_id AS groupId,
        front_text AS frontText,
        back_text AS backText,
        example_text AS exampleText,
        memo,
        memorized,
        position,
        is_test_data AS testData,
        created_at AS createdAt,
        updated_at AS updatedAt
        """;

    @Select("""
        SELECT
          g.id,
          g.user_id AS userId,
          g.title,
          g.description,
          g.source_label AS sourceLabel,
          COUNT(c.id) AS cardCount,
          g.is_test_data AS testData,
          g.created_at AS createdAt,
          g.updated_at AS updatedAt
        FROM memory_card_groups g
        LEFT JOIN memory_cards c ON c.group_id = g.id AND c.deleted_at IS NULL
        WHERE g.user_id = #{userId}
          AND g.deleted_at IS NULL
        GROUP BY g.id
        ORDER BY g.updated_at DESC, g.id DESC
        """)
    List<MemoryCardGroupRecord> findGroups(Long userId);

    @Select("""
        SELECT
        """ + GROUP_COLUMNS + """
        FROM memory_card_groups
        WHERE id = #{groupId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        LIMIT 1
        """)
    MemoryCardGroupRecord findGroup(@Param("groupId") Long groupId, @Param("userId") Long userId);

    @Insert("""
        INSERT INTO memory_card_groups (user_id, title, description, source_label, is_test_data)
        VALUES (#{userId}, #{title}, #{description}, #{sourceLabel}, #{testData})
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertGroup(MemoryCardGroupRecord record);

    @Update("""
        UPDATE memory_card_groups
        SET title = #{title},
            description = #{description},
            source_label = #{sourceLabel},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = #{id}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int updateGroup(MemoryCardGroupRecord record);

    @Update("""
        UPDATE memory_card_groups
        SET deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = #{groupId}
          AND user_id = #{userId}
          AND deleted_at IS NULL
        """)
    int softDeleteGroup(@Param("groupId") Long groupId, @Param("userId") Long userId);

    @Select("""
        SELECT
        """ + CARD_COLUMNS + """
        FROM memory_cards
        WHERE group_id = #{groupId}
          AND deleted_at IS NULL
        ORDER BY position ASC, id ASC
        """)
    List<MemoryCardRecord> findCards(Long groupId);

    @Select("""
        SELECT
        """ + CARD_COLUMNS + """
        FROM memory_cards
        WHERE id = #{cardId}
          AND deleted_at IS NULL
        LIMIT 1
        """)
    MemoryCardRecord findCard(Long cardId);

    @Select("""
        SELECT COALESCE(MAX(position), 0)
        FROM memory_cards
        WHERE group_id = #{groupId}
        """)
    int maxPosition(Long groupId);

    @Insert("""
        INSERT INTO memory_cards (group_id, front_text, back_text, example_text, memo, position, is_test_data)
        VALUES (#{groupId}, #{frontText}, #{backText}, #{exampleText}, #{memo}, #{position}, #{testData})
        """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertCard(MemoryCardRecord record);

    @Update("""
        UPDATE memory_cards
        SET front_text = #{frontText},
            back_text = #{backText},
            example_text = #{exampleText},
            memo = #{memo},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = #{id}
          AND group_id = #{groupId}
          AND deleted_at IS NULL
        """)
    int updateCard(MemoryCardRecord record);

    @Update("""
        UPDATE memory_cards
        SET memorized = #{memorized},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = #{id}
          AND group_id = #{groupId}
          AND deleted_at IS NULL
        """)
    int updateCardMemorized(MemoryCardRecord record);

    @Update("""
        UPDATE memory_cards
        SET deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = #{cardId}
          AND group_id = #{groupId}
          AND deleted_at IS NULL
        """)
    int softDeleteCard(@Param("cardId") Long cardId, @Param("groupId") Long groupId);

    @Update("""
        UPDATE memory_card_groups
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = #{groupId}
        """)
    int touchGroup(Long groupId);
}
