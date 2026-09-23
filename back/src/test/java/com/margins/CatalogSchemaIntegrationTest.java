package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.book.catalog.mapper.*;
import com.margins.testsupport.AbstractMySqlIntegrationTest;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class CatalogSchemaIntegrationTest extends AbstractMySqlIntegrationTest {
  @Autowired CatalogSearchMapper search;
  @Autowired CatalogBookMapper books;
  @Autowired CatalogCoverMapper covers;
  @Autowired CatalogSourceMapper sources;

  @Test
  void blankMigrationAndMetadataOnlyQueries() {
    assertThat(search.hmacKey()).hasSize(32);
    assertThat(covers.budget().getLimitBytes()).isEqualTo(10_000_000_000L);
    assertThat(sources.sources(false))
        .hasSize(8)
        .extracting(com.margins.book.catalog.model.CatalogRows.Source::getCode)
        .doesNotContain("aladin");
    assertThat(books.prefix(null, "fixture%", false, LocalDateTime.now())).isEmpty();
    assertThat(books.fulltext("fixture", false, LocalDateTime.now())).isEmpty();
    var jdbc = new JdbcTemplate(dataSource);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_books", Long.class)).isZero();
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM catalog_crawl_jobs", Long.class)).isZero();
  }
}
