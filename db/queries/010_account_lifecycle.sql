SELECT id, account_status, resigned_at, personal_data_purge_scheduled_at,
       personal_data_purged_at, erase_activity_on_purge
FROM users
WHERE account_status <> 'ACTIVE'
ORDER BY COALESCE(personal_data_purged_at, personal_data_purge_scheduled_at);

SELECT COUNT(*) AS overdue_purge_count
FROM users
WHERE account_status = 'RESIGNED'
  AND personal_data_purge_scheduled_at <= CURRENT_TIMESTAMP;

SELECT user_id, transition_type, result, processed_at
FROM account_lifecycle_events
ORDER BY processed_at DESC
LIMIT 100;
