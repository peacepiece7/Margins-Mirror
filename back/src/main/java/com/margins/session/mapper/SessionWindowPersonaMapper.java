package com.margins.session.mapper;

import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SessionWindowPersonaMapper {
    @Insert("""
        <script>
        INSERT INTO session_window_personas (window_id, persona_id, selection_order)
        VALUES
        <foreach collection='personaIds' item='personaId' index='index' separator=','>
          (#{windowId}, #{personaId}, #{index})
        </foreach>
        </script>
        """)
    int insertSelections(@Param("windowId") Long windowId, @Param("personaIds") List<Long> personaIds);

    @Select("""
        SELECT persona_id FROM session_window_personas
        WHERE window_id = #{windowId}
        ORDER BY selection_order ASC
        """)
    List<Long> findPersonaIds(@Param("windowId") Long windowId);
}