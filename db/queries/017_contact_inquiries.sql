-- 문의 원문이나 직접 식별자를 노출하지 않는 운영 aggregate.
SELECT
  status,
  COUNT(*) AS inquiry_count,
  SUM(delete_after <= CURRENT_TIMESTAMP) AS overdue_count,
  SUM(is_test_data = TRUE) AS test_data_count
FROM contact_inquiries
GROUP BY status
ORDER BY status;

SELECT COUNT(*) AS overdue_contact_inquiry_count
FROM contact_inquiries
WHERE delete_after <= CURRENT_TIMESTAMP;
