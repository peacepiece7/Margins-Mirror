package com.margins.book.catalog.mapper;

import com.margins.book.catalog.model.CatalogRows.*;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface CatalogJobMapper {
  String COLUMNS =
      " id,source_id,query_entry_id,source_record_id,generation,page_number,kind,state,dedupe_key,attempt_count,available_at,lease_token,lease_until,safe_error_code,finished_at,deadline_at,created_at,is_test_data"
          + " AS test_data ";

  @Insert(
      """
INSERT IGNORE INTO catalog_crawl_jobs
  (source_id,query_entry_id,source_record_id,generation,page_number,kind,state,dedupe_key,available_at,deadline_at,is_test_data)
VALUES (#{sourceId},#{queryEntryId},#{sourceRecordId},#{generation},#{pageNumber},#{kind},'QUEUED',#{dedupeKey},
  #{availableAt},#{deadlineAt},#{testData})
""")
  @Options(useGeneratedKeys = true, keyProperty = "id")
  int insert(Job job);

  @Select(
      """
      SELECT """
          + COLUMNS
          + """
FROM catalog_crawl_jobs WHERE available_at<=#{now} AND deadline_at>#{now} AND attempt_count<3
  AND (state IN ('QUEUED','RETRY') OR (state='RUNNING' AND lease_until<=#{now}))
ORDER BY CASE kind WHEN 'SEARCH' THEN 0 ELSE 1 END,available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED
""")
  Job claimable(LocalDateTime now);

  @Select("SELECT " + COLUMNS + " FROM catalog_crawl_jobs WHERE id=#{id} FOR UPDATE")
  Job lock(long id);

  @Select(
      "SELECT "
          + COLUMNS
          + " FROM catalog_crawl_jobs WHERE query_entry_id=#{id} AND generation=#{generation} ORDER"
          + " BY id")
  List<Job> generation(@Param("id") long id, @Param("generation") int generation);

  @Update(
      """
UPDATE catalog_crawl_jobs SET state=#{state},attempt_count=#{attemptCount},available_at=#{availableAt},
  lease_token=#{leaseToken},lease_until=#{leaseUntil},safe_error_code=#{safeErrorCode},finished_at=#{finishedAt}
WHERE id=#{id}
""")
  int update(Job job);

  @Update(
      """
UPDATE catalog_crawl_jobs SET lease_until=#{until} WHERE id=#{id} AND state='RUNNING' AND lease_token=#{token}
  AND deadline_at>#{now}
""")
  int heartbeat(
      @Param("id") long id,
      @Param("token") String token,
      @Param("now") LocalDateTime now,
      @Param("until") LocalDateTime until);

  @Select(
      """
      SELECT """
          + COLUMNS
          + """
FROM catalog_crawl_jobs
WHERE state IN ('QUEUED','RETRY','RUNNING')
  AND (deadline_at<=#{now} OR (state='RUNNING' AND lease_until<=#{now} AND attempt_count>=3))
ORDER BY id LIMIT 100
""")
  List<Job> expired(LocalDateTime now);

  @Select("SELECT " + COLUMNS + " FROM catalog_crawl_jobs ORDER BY id DESC LIMIT 100")
  List<Job> recent();

  @Delete(
      "DELETE FROM catalog_crawl_jobs WHERE finished_at<=#{before} AND state IN"
          + " ('SUCCEEDED','FAILED','CANCELLED') LIMIT 1000")
  int purge(LocalDateTime before);

  @Update(
      """
UPDATE catalog_crawl_jobs SET state='CANCELLED',finished_at=#{now},lease_token=NULL,lease_until=NULL,safe_error_code='SOURCE_PAUSED'
WHERE source_id=#{id} AND state IN ('QUEUED','RETRY','RUNNING')
""")
  int cancelSource(@Param("id") long id, @Param("now") LocalDateTime now);
}
