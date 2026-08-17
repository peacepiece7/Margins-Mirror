package com.margins.membership.mapper;

import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MembershipMapper {

    @Select("""
        SELECT tier
        FROM user_memberships
        WHERE user_id = #{userId}
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        LIMIT 1
        """)
    Optional<String> findActiveTier(Long userId);
}
