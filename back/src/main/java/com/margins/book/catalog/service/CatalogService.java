package com.margins.book.catalog.service;

import com.margins.book.catalog.business.*;
import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.mapper.CatalogCoverMapper;
import com.margins.book.catalog.model.CatalogRows.Cover;
import com.margins.book.dto.SaveBookResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CatalogService {
  private final CatalogSearchBusiness search;
  private final CatalogSaveBusiness save;
  private final CatalogOperationsBusiness operations;
  private final CatalogCoverMapper covers;
  private final CatalogTime time;

  public SearchResponse search(SearchRequest request) {
    return search.search(request);
  }

  public SearchResponse next(String id, String cursor, int limit) {
    return search.next(id, cursor, limit);
  }

  public Candidate detail(long id) {
    return search.detail(id);
  }

  public CollectionStatus collection(String id) {
    return search.status(id);
  }

  public SaveBookResponse save(SaveRequest request) {
    return save.save(request);
  }

  public Capabilities capabilities() {
    return new Capabilities(operations.operator());
  }

  public Operations operations() {
    return operations.read();
  }

  public void source(long id, SourceAction action) {
    operations.source(id, action);
  }

  public void withdraw(long id) {
    operations.withdraw(id);
  }

  public Cover cover(long id) {
    return covers.permitted(id, time.now());
  }

  public byte[] image(long id, byte[] hash) {
    var row = covers.bytes(id, hash, time.now());
    return row == null ? null : row.getImageBytes();
  }
}
