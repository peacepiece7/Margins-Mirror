-- Migration 046: allow the bounded discussion-structure moderation intent.
--
-- Existing moderation events and raw-input privacy checks remain unchanged. This migration only
-- widens the accepted intent values so a DISCUSSION_STRUCTURE redirect can be persisted without
-- rewriting historical rows.
ALTER TABLE moderation_events
  DROP CHECK chk_moderation_events_intent;

ALTER TABLE moderation_events
  ADD CONSTRAINT chk_moderation_events_intent
  CHECK (intent IN (
    'BOOK_DISCUSSION',
    'DISCUSSION_STRUCTURE',
    'BENIGN_OFF_TOPIC',
    'SPAM',
    'MEANINGLESS',
    'BYPASS_ATTEMPT'
  ));
