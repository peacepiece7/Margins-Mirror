package com.margins.book.catalog.mapper;

import com.margins.book.catalog.model.CatalogRows.*;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface CatalogSourceMapper {
  @Insert(
      """
INSERT INTO catalog_sources (code,display_name,adapter_type,priority,is_test_data)
SELECT code,display_name,adapter_type,priority,TRUE FROM catalog_sources WHERE is_test_data=FALSE
ON DUPLICATE KEY UPDATE code=VALUES(code)
""")
  int ensureTestSources();

  String COLUMNS =
      "id,code,display_name,adapter_type,status,metadata_policy,cover_policy,policy_reference,approved_fields,"
          + "metadata_ttl_seconds,cover_ttl_seconds,policy_version,policy_expires_at,priority,min_interval_ms,daily_request_limit,quota_date,requests_today,next_request_at,backoff_until,consecutive_failures,is_test_data"
          + " AS test_data";

  @Select(
      "SELECT "
          + COLUMNS
          + " FROM catalog_sources WHERE is_test_data=#{testData} ORDER BY priority,id")
  List<Source> sources(boolean testData);

  @Select("SELECT " + COLUMNS + " FROM catalog_sources WHERE id=#{id}")
  Source source(long id);

  @Select("SELECT " + COLUMNS + " FROM catalog_sources WHERE id=#{id} FOR UPDATE")
  Source lock(long id);

  @Update(
      """
UPDATE catalog_sources SET
  status=CASE WHEN status IN ('PAUSED','REVOKED') THEN status ELSE #{status} END,
  metadata_policy=#{metadataPolicy},cover_policy=#{coverPolicy},policy_reference=#{policyReference},
  approved_fields=#{approvedFields}
WHERE id=#{id}
""")
  int configure(Source source);

  @Update(
      """
UPDATE catalog_sources SET quota_date=#{now}, requests_today=#{count}, next_request_at=#{next}
WHERE id=#{id}
""")
  int reserve(
      @Param("id") long id,
      @Param("now") LocalDateTime now,
      @Param("next") LocalDateTime next,
      @Param("count") int count);

  @Update(
      """
      UPDATE catalog_sources SET consecutive_failures=consecutive_failures+1,
        backoff_until=CASE WHEN backoff_until>#{until} THEN backoff_until ELSE #{until} END
      WHERE id=#{id}
      """)
  int failure(@Param("id") long id, @Param("until") LocalDateTime until);

  @Update("UPDATE catalog_sources SET consecutive_failures=0 WHERE id=#{id}")
  int success(long id);

  @Update("UPDATE catalog_sources SET status=#{status} WHERE id=#{id}")
  int status(@Param("id") long id, @Param("status") String status);
}
