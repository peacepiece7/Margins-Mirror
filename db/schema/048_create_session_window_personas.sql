-- 토론방별 선택 페르소나와 선택 순서 보존.
CREATE TABLE IF NOT EXISTS session_window_personas (
  window_id BIGINT NOT NULL COMMENT '선택이 저장된 토론방 식별자',
  persona_id BIGINT NOT NULL COMMENT '선택된 페르소나 식별자',
  selection_order INT NOT NULL COMMENT '방 안의 페르소나 선택 순서',
  PRIMARY KEY (window_id, persona_id),
  UNIQUE KEY uk_session_window_persona_order (window_id, selection_order),
  CONSTRAINT fk_session_window_personas_window FOREIGN KEY (window_id) REFERENCES session_windows (id),
  CONSTRAINT fk_session_window_personas_persona FOREIGN KEY (persona_id) REFERENCES personas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='토론방 선택 페르소나 관계';
