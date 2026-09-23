package com.margins.book.catalog.mapper;

import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface CatalogResultMapper {
  record SourcePage(long sourceId, int completedPage, boolean hasMore) {}

  record Hit(long catalogBookId, int sourceRank) {}

  record Item(long book, int ordinal, String match) {}

  @Insert(
      """
INSERT INTO catalog_search_source_runs(query_entry_id,generation,source_id,completed_page,has_more,is_test_data)
VALUES(#{query},#{generation},#{source},#{page},#{more},#{test})
ON DUPLICATE KEY UPDATE completed_page=VALUES(completed_page),has_more=VALUES(has_more)
""")
  void progress(
      @Param("query") long query,
      @Param("generation") int generation,
      @Param("source") long source,
      @Param("page") int page,
      @Param("more") boolean more,
      @Param("test") boolean test);

  @Select(
      "SELECT source_id,completed_page,has_more FROM catalog_search_source_runs WHERE"
          + " query_entry_id=#{query} AND generation=#{generation} ORDER BY source_id")
  List<SourcePage> pages(@Param("query") long query, @Param("generation") int generation);

  @Insert(
      """
INSERT INTO catalog_search_hits(query_entry_id,generation,source_id,catalog_book_id,source_rank,is_test_data)
VALUES(#{query},#{generation},#{source},#{book},#{rank},#{test})
ON DUPLICATE KEY UPDATE source_rank=LEAST(source_rank,VALUES(source_rank))
""")
  void hit(
      @Param("query") long query,
      @Param("generation") int generation,
      @Param("source") long source,
      @Param("book") long book,
      @Param("rank") int rank,
      @Param("test") boolean test);

  @Select(
      """
SELECT catalog_book_id,MIN(source_rank) AS source_rank FROM catalog_search_hits
WHERE query_entry_id=#{query} AND generation=#{generation}
GROUP BY catalog_book_id ORDER BY source_rank,catalog_book_id
""")
  List<Hit> hits(@Param("query") long query, @Param("generation") int generation);

  @Insert(
      """
<script>INSERT INTO catalog_search_snapshot_items(snapshot_id,ordinal,catalog_book_id,match_type,is_test_data) VALUES
<foreach collection="items" item="item" separator=",">
(#{snapshot},#{item.ordinal},#{item.book},#{item.match},#{test})
</foreach></script>
""")
  void items(
      @Param("snapshot") long snapshot,
      @Param("items") List<Item> items,
      @Param("test") boolean test);

  @Select(
      "SELECT catalog_book_id FROM catalog_search_snapshot_items WHERE snapshot_id=#{snapshot} AND"
          + " ordinal>=#{offset} ORDER BY ordinal LIMIT #{limit}")
  List<Long> page(
      @Param("snapshot") long snapshot, @Param("offset") int offset, @Param("limit") int limit);

  @Select("SELECT COUNT(*) FROM catalog_search_snapshot_items WHERE snapshot_id=#{snapshot}")
  int count(long snapshot);
}
