package com.margins.book.catalog.mapper;

import com.margins.book.catalog.model.CatalogRows.*;
import java.time.LocalDateTime;
import org.apache.ibatis.annotations.*;

@Mapper
public interface CatalogSearchMapper {
  String QUERY_COLUMNS =
      "id,public_id,query_key,key_version,query_text,text_expires_at,generation,result_version,cover_version,last_outcome,last_collected_at,revalidate_after,retry_after,cached_book_ids,source_outcomes,retire_after,is_test_data"
          + " AS test_data";

  @Select("SELECT query_hmac_key FROM catalog_storage_budget WHERE id=1")
  Secret secret();

  record Secret(byte[] queryHmacKey) {}

  default byte[] hmacKey() {
    return secret().queryHmacKey();
  }

  @Insert(
      """
INSERT INTO catalog_search_entries
  (public_id,query_key,key_version,query_text,text_expires_at,cached_book_ids,source_outcomes,retire_after,is_test_data)
VALUES (#{publicId},#{queryKey},1,NULL,NULL,'[]','{}',#{retireAfter},#{testData})
ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
""")
  int insertQuery(Query query);

  @Select(
      "SELECT "
          + QUERY_COLUMNS
          + " FROM catalog_search_entries WHERE query_key=#{key} AND is_test_data=#{testData} FOR"
          + " UPDATE")
  Query lockKey(@Param("key") byte[] key, @Param("testData") boolean testData);

  @Select("SELECT " + QUERY_COLUMNS + " FROM catalog_search_entries WHERE id=#{id} FOR UPDATE")
  Query lock(long id);

  @Select("SELECT " + QUERY_COLUMNS + " FROM catalog_search_entries WHERE id=#{id}")
  Query find(long id);

  @Select(
      "SELECT "
          + QUERY_COLUMNS
          + " FROM catalog_search_entries WHERE public_id=#{id} AND is_test_data=#{testData}")
  Query findPublic(@Param("id") String id, @Param("testData") boolean testData);

  @Update(
      """
UPDATE catalog_search_entries SET query_text=#{queryText},text_expires_at=#{textExpiresAt},
  generation=#{generation},result_version=#{resultVersion},last_outcome=#{lastOutcome},
  last_collected_at=#{lastCollectedAt},revalidate_after=#{revalidateAfter},retry_after=#{retryAfter},
  cached_book_ids=#{cachedBookIds},source_outcomes=#{sourceOutcomes},retire_after=#{retireAfter}
WHERE id=#{id}
""")
  int update(Query query);

  @Update("UPDATE catalog_search_entries SET result_version=result_version+1 WHERE id=#{id}")
  int bumpVersion(long id);

  @Update("UPDATE catalog_search_entries SET cover_version=cover_version+1 WHERE id=#{id}")
  int bumpCoverVersion(long id);

  @Insert(
      """
INSERT INTO catalog_search_snapshots
  (public_id,query_entry_id,generation,result_version,query_field,language_filter,format_filter,
   ranking_version,ranked_books,truncated,expires_at,is_test_data)
VALUES (#{publicId},#{queryEntryId},#{generation},#{resultVersion},#{queryField},#{languageFilter},
   #{formatFilter},#{rankingVersion},#{rankedBooks},#{truncated},#{expiresAt},#{testData})
""")
  @Options(useGeneratedKeys = true, keyProperty = "id")
  int insertSnapshot(Snapshot snapshot);

  @Select(
      """
SELECT id,public_id,query_entry_id,generation,result_version,query_field,language_filter,format_filter,
  ranking_version,ranked_books,truncated,expires_at,is_test_data AS test_data
FROM catalog_search_snapshots WHERE public_id=#{id} AND is_test_data=#{testData}
""")
  Snapshot snapshot(@Param("id") String id, @Param("testData") boolean testData);

  @Update(
      "UPDATE catalog_search_entries SET query_text=NULL,text_expires_at=NULL WHERE"
          + " text_expires_at<=#{now} AND query_text IS NOT NULL")
  int clearText(LocalDateTime now);

  @Delete("DELETE FROM catalog_search_snapshots WHERE expires_at<=#{now} LIMIT 1000")
  int purgeSnapshots(LocalDateTime now);

  @Delete(
      """
DELETE FROM catalog_search_entries WHERE retire_after<=#{now}
  AND (revalidate_after IS NULL OR revalidate_after<=#{now})
  AND NOT EXISTS (SELECT 1 FROM catalog_crawl_jobs j WHERE j.query_entry_id=catalog_search_entries.id)
  AND NOT EXISTS (SELECT 1 FROM catalog_search_snapshots s WHERE s.query_entry_id=catalog_search_entries.id)
LIMIT 1000
""")
  int purgeQueries(LocalDateTime now);
}
