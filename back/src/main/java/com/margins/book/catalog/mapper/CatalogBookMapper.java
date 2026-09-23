package com.margins.book.catalog.mapper;

import com.margins.book.catalog.model.CatalogRows.*;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface CatalogBookMapper {
  String COLUMNS =
      " b.id,b.isbn13,b.title,b.subtitle,b.authors_display,b.title_normalized,b.authors_normalized,b.publisher,"
          + "b.published_date_text,b.language_code,b.format,b.page_count,b.description,b.field_provenance,b.status,b.cover_asset_id,b.metadata_checked_at,b.expires_at,b.is_test_data"
          + " AS test_data ";
  String VISIBLE = " b.status='ACTIVE' AND (b.expires_at IS NULL OR b.expires_at>#{now}) ";
  String RECORD_COLUMNS =
      " r.id,r.catalog_book_id,r.source_id,r.external_id,r.source_url,r.source_kind,r.normalized_payload,r.payload_sha256,r.parser_version,r.policy_version,r.status,r.cover_status,r.fetched_at,r.expires_at,r.is_test_data"
          + " AS test_data ";

  @Select(
      """
      <script>
      SELECT """
          + COLUMNS
          + """
            FROM catalog_books b WHERE b.is_test_data=#{testData} AND """
          + VISIBLE
          + """
            AND (b.isbn13=#{isbn} OR b.title_normalized LIKE #{prefix} ESCAPE '!'
              OR b.authors_normalized LIKE #{prefix} ESCAPE '!')
            ORDER BY (b.isbn13=#{isbn}) DESC,b.id LIMIT 300
            </script>
            """)
  List<Book> prefix(
      @Param("isbn") String isbn,
      @Param("prefix") String prefix,
      @Param("testData") boolean testData,
      @Param("now") LocalDateTime now);

  @Select(
      """
      SELECT """
          + COLUMNS
          + """
            FROM catalog_books b WHERE b.is_test_data=#{testData} AND """
          + VISIBLE
          + """
AND MATCH(b.title_normalized,b.authors_normalized) AGAINST(#{keyword} IN NATURAL LANGUAGE MODE)
ORDER BY MATCH(b.title_normalized,b.authors_normalized) AGAINST(#{keyword} IN NATURAL LANGUAGE MODE) DESC,b.id
LIMIT 300
""")
  List<Book> fulltext(
      @Param("keyword") String keyword,
      @Param("testData") boolean testData,
      @Param("now") LocalDateTime now);

  @Select(
      """
      <script>SELECT """
          + COLUMNS
          + """
            FROM catalog_books b WHERE b.is_test_data=#{testData} AND """
          + VISIBLE
          + """
AND b.id IN <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
</script>
""")
  List<Book> books(
      @Param("ids") List<Long> ids,
      @Param("testData") boolean testData,
      @Param("now") LocalDateTime now);

  @Select("SELECT " + COLUMNS + " FROM catalog_books b WHERE b.id=#{id} FOR UPDATE")
  Book lockBook(long id);

  @Select(
      "SELECT "
          + COLUMNS
          + " FROM catalog_books b WHERE b.isbn13=#{isbn} AND b.is_test_data=#{testData}")
  Book isbn(@Param("isbn") String isbn, @Param("testData") boolean testData);

  @Update("UPDATE catalog_books SET isbn13=#{isbn} WHERE id=#{id} AND isbn13 IS NULL")
  int identify(@Param("id") long id, @Param("isbn") String isbn);

  @Insert(
      """
INSERT INTO catalog_books
  (isbn13,title,subtitle,authors_display,title_normalized,authors_normalized,publisher,published_date_text,
   language_code,format,page_count,description,field_provenance,status,metadata_checked_at,expires_at,is_test_data)
VALUES (#{isbn13},#{title},#{subtitle},#{authorsDisplay},#{titleNormalized},#{authorsNormalized},#{publisher},
   #{publishedDateText},#{languageCode},#{format},#{pageCount},#{description},#{fieldProvenance},#{status},
   #{metadataCheckedAt},#{expiresAt},#{testData})
ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
""")
  @Options(useGeneratedKeys = true, keyProperty = "id")
  int insertBook(Book book);

  @Update(
      """
UPDATE catalog_books SET title=#{title},subtitle=#{subtitle},authors_display=#{authorsDisplay},
  title_normalized=#{titleNormalized},authors_normalized=#{authorsNormalized},publisher=#{publisher},
  published_date_text=#{publishedDateText},language_code=#{languageCode},format=#{format},
  page_count=#{pageCount},description=#{description},field_provenance=#{fieldProvenance},status=#{status},
  metadata_checked_at=#{metadataCheckedAt},expires_at=#{expiresAt}
WHERE id=#{id}
""")
  int project(Book book);

  @Select(
      "SELECT "
          + RECORD_COLUMNS
          + " FROM catalog_book_sources r WHERE r.source_id=#{sourceId} AND"
          + " r.external_id=#{externalId} AND r.is_test_data=#{testData}")
  SourceRecord record(
      @Param("sourceId") long sourceId,
      @Param("externalId") String externalId,
      @Param("testData") boolean testData);

  @Select("SELECT " + RECORD_COLUMNS + " FROM catalog_book_sources r WHERE r.id=#{id}")
  SourceRecord recordId(long id);

  @Select(
      """
      <script>SELECT """
          + RECORD_COLUMNS
          + """
            FROM catalog_book_sources r WHERE r.catalog_book_id IN
            <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
            ORDER BY r.source_id,r.id</script>
            """)
  List<SourceRecord> records(@Param("ids") List<Long> ids);

  @Insert(
      """
INSERT INTO catalog_book_sources
  (catalog_book_id,source_id,external_id,source_url,source_kind,normalized_payload,payload_sha256,parser_version,
   policy_version,status,cover_status,fetched_at,expires_at,is_test_data)
VALUES (#{catalogBookId},#{sourceId},#{externalId},#{sourceUrl},'EDITION',#{normalizedPayload},#{payloadSha256},
  #{parserVersion},#{policyVersion},#{status},#{coverStatus},#{fetchedAt},#{expiresAt},#{testData})
""")
  @Options(useGeneratedKeys = true, keyProperty = "id")
  int insertRecord(SourceRecord record);

  @Update(
      """
UPDATE catalog_book_sources SET normalized_payload=#{normalizedPayload},payload_sha256=#{payloadSha256},
  parser_version=#{parserVersion},policy_version=#{policyVersion},status=#{status},source_url=#{sourceUrl},
  fetched_at=#{fetchedAt},expires_at=#{expiresAt},cover_status=#{coverStatus} WHERE id=#{id}
""")
  int updateRecord(SourceRecord record);

  @Update("UPDATE catalog_book_sources SET status='CONFLICT' WHERE id=#{id}")
  int conflict(long id);

  @Update("UPDATE catalog_book_sources SET cover_status=#{status} WHERE id=#{id}")
  int coverStatus(@Param("id") long id, @Param("status") String status);

  @Update("UPDATE catalog_books SET cover_asset_id=#{coverId} WHERE id=#{id}")
  int cover(@Param("id") long id, @Param("coverId") Long coverId);

  @Select(
      """
      SELECT """
          + COLUMNS
          + """
            FROM catalog_books b WHERE b.id>#{after} ORDER BY b.id LIMIT 100
            """)
  List<Book> maintenancePage(long after);

  @Update(
      """
UPDATE catalog_book_sources r SET normalized_payload=NULL,status='EXPIRED'
WHERE normalized_payload IS NOT NULL AND (expires_at<=#{now} OR status IN ('WITHDRAWN','EXPIRED')
  OR EXISTS (SELECT 1 FROM catalog_sources s WHERE s.id=r.source_id AND
    (s.status='REVOKED' OR s.metadata_policy<>'ALLOWED' OR s.policy_expires_at<=#{now}
     OR s.policy_version<>r.policy_version))) LIMIT 1000
""")
  int expirePayloads(LocalDateTime now);
}
