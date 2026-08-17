ALTER TABLE discussion_guides
  ADD COLUMN generation_metadata_json JSON NULL
    COMMENT 'provider·model·prompt·schema·latency·outcome 메타데이터'
    AFTER token_usage_json;
