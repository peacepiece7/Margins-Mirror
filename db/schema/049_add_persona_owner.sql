-- Add ownership and an explicit shared marker so unknown legacy personas remain stored
-- but cannot leak into another reader's persona list or AI context.
ALTER TABLE personas
  ADD COLUMN created_by_user_id BIGINT NULL COMMENT '사용자 생성 페르소나 소유자 식별자',
  ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT FALSE COMMENT '모든 사용자에게 제공되는 seed 페르소나 여부',
  ADD KEY idx_personas_created_by_user (created_by_user_id),
  ADD CONSTRAINT fk_personas_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users (id);

UPDATE personas
SET is_shared = TRUE
WHERE name IN (
  'psychological-counselor', 'journalist', 'elementary-school-teacher',
  'college-student', 'neighborhood-grandmother', 'soldier',
  'middle-school-teacher', 'lawyer', 'university-professor', 'doctor',
  'developer', 'writer'
)
  AND created_by_user_id IS NULL;
