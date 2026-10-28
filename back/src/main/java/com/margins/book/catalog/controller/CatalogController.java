package com.margins.book.catalog.controller;

import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.service.CatalogService;
import com.margins.book.dto.SaveBookResponse;
import com.margins.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class CatalogController {
  private final CatalogService service;

  private <T> ResponseEntity<ApiResponse<T>> response(T value) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore().cachePrivate())
        .body(ApiResponse.ok(value));
  }

  @PostMapping("/api/catalog/search")
  public ResponseEntity<ApiResponse<SearchResponse>> search(
      @Valid @RequestBody SearchRequest request) {
    return response(service.search(request));
  }

  @GetMapping("/api/catalog/search-snapshots/{id}")
  public ResponseEntity<ApiResponse<SearchResponse>> next(
      @PathVariable String id,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return response(service.next(id, cursor, limit));
  }

  @GetMapping("/api/catalog/collections/{id}")
  public ResponseEntity<ApiResponse<CollectionStatus>> collection(@PathVariable String id) {
    return response(service.collection(id));
  }

  @GetMapping("/api/catalog/books/{id}")
  public ResponseEntity<ApiResponse<Candidate>> detail(@PathVariable long id) {
    return response(service.detail(id));
  }

  @PostMapping("/api/books/from-catalog")
  public ResponseEntity<ApiResponse<SaveBookResponse>> save(
      @Valid @RequestBody SaveRequest request) {
    return response(service.save(request));
  }

  @GetMapping("/api/catalog/capabilities")
  public ResponseEntity<ApiResponse<Capabilities>> capabilities() {
    return response(service.capabilities());
  }

  @GetMapping("/api/catalog/operations")
  public ResponseEntity<ApiResponse<Operations>> operations() {
    return response(service.operations());
  }

  @PostMapping("/api/catalog/operations/sources/{id}")
  public ResponseEntity<ApiResponse<Capabilities>> source(
      @PathVariable long id, @Valid @RequestBody SourceAction action) {
    service.source(id, action);
    return response(service.capabilities());
  }

  @PostMapping("/api/catalog/operations/covers/{id}/withdraw")
  public ResponseEntity<ApiResponse<Capabilities>> withdraw(@PathVariable long id) {
    service.withdraw(id);
    return response(service.capabilities());
  }
}
