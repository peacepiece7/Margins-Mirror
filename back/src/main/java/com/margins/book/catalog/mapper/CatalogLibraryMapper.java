package com.margins.book.catalog.mapper;

import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface CatalogLibraryMapper {
  record Match(Long id, Long catalogBookId, String isbn) {}

  @Select(
      """
      <script>
      SELECT id,catalog_book_id,isbn FROM books WHERE user_id=#{userId} AND deleted_at IS NULL
      AND (catalog_book_id IN
      <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
      <if test="isbns.size > 0"> OR isbn IN
      <foreach collection="isbns" item="isbn" open="(" separator="," close=")">#{isbn}</foreach>
      </if>)
      ORDER BY id
      </script>
      """)
  List<Match> matches(
      @Param("userId") long userId,
      @Param("ids") List<Long> ids,
      @Param("isbns") List<String> isbns);

  @Update(
      """
UPDATE books SET catalog_book_id=#{catalogId},is_test_data=#{testData},
  raw_metadata=JSON_SET(COALESCE(raw_metadata,JSON_OBJECT()),'$.catalogOrigin',
    JSON_OBJECT('records',(SELECT JSON_ARRAYAGG(JSON_OBJECT('id',r.id,'version',r.policy_version,'expiresAt',r.expires_at))
      FROM catalog_book_sources r WHERE r.catalog_book_id=#{catalogId} AND r.status='ACTIVE')))
WHERE id=#{id} AND
"""
          + " user_id=#{userId}")
  int attach(
      @Param("id") long id,
      @Param("userId") long userId,
      @Param("catalogId") long catalogId,
      @Param("testData") boolean testData);

  @Update(
      """
      UPDATE books SET cover_image_url=#{path} WHERE catalog_book_id=#{id} AND deleted_at IS NULL
      AND (cover_image_url IS NULL OR cover_image_url LIKE '/api/catalog/covers/%')
      """)
  int cover(@Param("id") long catalogId, @Param("path") String path);

  @Update(
      "UPDATE books SET"
          + " cover_image_url=NULL,raw_metadata=JSON_REMOVE(raw_metadata,'$.providerMetadata.thumbnail')"
          + " WHERE cover_image_url LIKE CONCAT('/api/catalog/covers/',#{id},'/%')")
  int clearCover(long id);

  @Update(
      """
UPDATE books b SET
  description=CASE WHEN description=JSON_UNQUOTE(JSON_EXTRACT(raw_metadata,'$.providerMetadata.description')) THEN NULL ELSE description END,
  raw_metadata=JSON_REMOVE(raw_metadata,'$.providerMetadata','$.catalogOrigin')
WHERE catalog_book_id IS NOT NULL AND JSON_CONTAINS_PATH(raw_metadata,'one','$.catalogOrigin.records')=1
AND EXISTS (
  SELECT 1 FROM JSON_TABLE(b.raw_metadata,'$.catalogOrigin.records[*]' COLUMNS(
    record_id BIGINT PATH '$.id',policy_version INT PATH '$.version',
    expires_at DATETIME PATH '$.expiresAt' NULL ON EMPTY NULL ON ERROR)) origin
  LEFT JOIN catalog_book_sources r ON r.id=origin.record_id
  LEFT JOIN catalog_sources s ON s.id=r.source_id
  WHERE r.id IS NULL OR r.status IN ('WITHDRAWN','EXPIRED','CONFLICT')
    OR origin.expires_at<=#{now} OR r.expires_at<=#{now}
    OR s.status='REVOKED' OR s.metadata_policy<>'ALLOWED'
    OR s.policy_expires_at<=#{now} OR s.policy_version<>origin.policy_version
) LIMIT 100
""")
  int scrubExpiredCopies(java.time.LocalDateTime now);
}
