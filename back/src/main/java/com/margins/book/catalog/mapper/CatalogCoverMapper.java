package com.margins.book.catalog.mapper;

import com.margins.book.catalog.model.CatalogRows.*;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface CatalogCoverMapper {
  String META =
      " c.id,c.source_record_id,c.sha256,c.source_url,c.mime_type,c.width,c.height,c.byte_size,c.policy_version,c.status,c.fetched_at,c.expires_at,c.is_test_data"
          + " AS test_data ";
  String PERMITTED =
      " "
          + """
            c.status='READY' AND (c.expires_at IS NULL OR c.expires_at>#{now})
            AND r.status='ACTIVE' AND (r.expires_at IS NULL OR r.expires_at>#{now})
            AND s.status='ACTIVE' AND s.cover_policy='ALLOWED' AND s.metadata_policy='ALLOWED'
            AND c.policy_version=s.policy_version AND r.policy_version=s.policy_version
            AND (s.policy_expires_at IS NULL OR s.policy_expires_at>#{now})
            """;

  @Select("SELECT limit_bytes,used_bytes FROM catalog_storage_budget WHERE id=1 FOR UPDATE")
  Budget lockBudget();

  @Select("SELECT limit_bytes,used_bytes FROM catalog_storage_budget WHERE id=1")
  Budget budget();

  @Update("UPDATE catalog_storage_budget SET used_bytes=#{bytes} WHERE id=1")
  int budgetBytes(long bytes);

  @Select("SELECT COALESCE(SUM(OCTET_LENGTH(image_bytes)),0) FROM catalog_cover_assets")
  long actualBytes();

  @Select("SELECT COUNT(*) FROM catalog_cover_assets WHERE image_bytes IS NOT NULL")
  long count();

  @Select(
      "SELECT "
          + META
          + " FROM catalog_cover_assets c WHERE c.source_record_id=#{recordId} AND c.sha256=#{sha}")
  Cover same(@Param("recordId") long recordId, @Param("sha") byte[] sha);

  @Select("SELECT " + META + " FROM catalog_cover_assets c WHERE c.id=#{id}")
  Cover metadata(long id);

  @Select(
      """
      SELECT """
          + META
          + """
            FROM catalog_cover_assets c
            JOIN catalog_book_sources r ON r.id=c.source_record_id
            JOIN catalog_sources s ON s.id=r.source_id
            WHERE c.id=#{id} AND """
          + PERMITTED)
  Cover permitted(@Param("id") long id, @Param("now") LocalDateTime now);

  @Select(
      """
      <script>SELECT """
          + META
          + """
            FROM catalog_cover_assets c JOIN catalog_book_sources r ON r.id=c.source_record_id
            JOIN catalog_sources s ON s.id=r.source_id WHERE c.id IN
            <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
            AND """
          + PERMITTED
          + """
            </script>
            """)
  List<Cover> permittedList(@Param("ids") List<Long> ids, @Param("now") LocalDateTime now);

  @Select(
      """
SELECT c.image_bytes FROM catalog_cover_assets c
JOIN catalog_book_sources r ON r.id=c.source_record_id JOIN catalog_sources s ON s.id=r.source_id
WHERE c.id=#{id} AND c.sha256=#{sha} AND """
          + PERMITTED)
  Cover bytes(@Param("id") long id, @Param("sha") byte[] sha, @Param("now") LocalDateTime now);

  @Insert(
      """
INSERT INTO catalog_cover_assets
  (source_record_id,sha256,source_url,mime_type,width,height,byte_size,image_bytes,policy_version,status,fetched_at,expires_at,is_test_data)
VALUES (#{sourceRecordId},#{sha256},#{sourceUrl},#{mimeType},#{width},#{height},#{byteSize},#{imageBytes},
  #{policyVersion},'READY',#{fetchedAt},#{expiresAt},#{testData})
""")
  @Options(useGeneratedKeys = true, keyProperty = "id")
  int insert(Cover cover);

  @Update(
      """
UPDATE catalog_cover_assets SET image_bytes=#{imageBytes},byte_size=#{byteSize},status='READY',
  policy_version=#{policyVersion},fetched_at=#{fetchedAt},expires_at=#{expiresAt} WHERE id=#{id}
""")
  int restore(Cover cover);

  @Update("UPDATE catalog_cover_assets SET status='WITHDRAWN',image_bytes=NULL WHERE id=#{id}")
  int withdraw(long id);

  @Select("SELECT COALESCE(OCTET_LENGTH(image_bytes),0) FROM catalog_cover_assets WHERE id=#{id}")
  long storedSize(long id);

  @Update("UPDATE catalog_cover_assets SET status=#{status},image_bytes=NULL WHERE id=#{id}")
  int release(@Param("id") long id, @Param("status") String status);

  @Update("UPDATE catalog_books SET cover_asset_id=NULL WHERE cover_asset_id=#{id}")
  int clearPointer(long id);

  @Select(
      """
SELECT c.id FROM catalog_cover_assets c
JOIN catalog_book_sources r ON r.id=c.source_record_id
JOIN catalog_sources s ON s.id=r.source_id
WHERE c.image_bytes IS NOT NULL AND (
  c.status<>'READY' OR c.expires_at<=#{now} OR r.status<>'ACTIVE' OR r.expires_at<=#{now}
  OR s.status='REVOKED' OR s.cover_policy<>'ALLOWED' OR s.metadata_policy<>'ALLOWED'
  OR s.policy_expires_at<=#{now} OR c.policy_version<>s.policy_version
  OR (c.created_at<#{orphanBefore} AND NOT EXISTS (SELECT 1 FROM catalog_books b WHERE b.cover_asset_id=c.id)))
ORDER BY c.id LIMIT 100
""")
  List<Long> expired(
      @Param("now") LocalDateTime now, @Param("orphanBefore") LocalDateTime orphanBefore);
}
