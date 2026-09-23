package com.margins.book.catalog.controller;

import com.margins.book.catalog.business.CatalogText;
import com.margins.book.catalog.service.CatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class CatalogCoverController {
  private final CatalogService service;

  @GetMapping("/api/catalog/covers/{id}/{hash}")
  public ResponseEntity<byte[]> image(
      @PathVariable long id,
      @PathVariable String hash,
      @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {
    if (!hash.matches("[a-f0-9]{64}")) return missing();
    var cover = service.cover(id);
    if (cover == null || !hash.equals(CatalogText.hex(cover.getSha256()))) return missing();
    String etag = "\"" + hash + "\"";
    var builder =
        ResponseEntity.ok()
            .header("Cache-Control", "public, max-age=0, must-revalidate")
            .header("X-Content-Type-Options", "nosniff")
            .eTag(etag)
            .contentType(MediaType.parseMediaType(cover.getMimeType()));
    // Permission is checked before conditional requests, including a previously valid ETag.
    if (etag.equals(ifNoneMatch))
      return ResponseEntity.status(304)
          .header("Cache-Control", "public, max-age=0, must-revalidate")
          .eTag(etag)
          .build();
    byte[] bytes = service.image(id, cover.getSha256());
    return bytes == null ? missing() : builder.contentLength(bytes.length).body(bytes);
  }

  private ResponseEntity<byte[]> missing() {
    return ResponseEntity.status(404).cacheControl(CacheControl.noStore()).build();
  }
}
