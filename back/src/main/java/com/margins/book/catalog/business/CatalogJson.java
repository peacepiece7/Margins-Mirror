package com.margins.book.catalog.business;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CatalogJson {
  private final ObjectMapper mapper;

  public String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception ex) {
      throw new IllegalStateException("Catalog serialization failed");
    }
  }

  public List<Long> ids(String value) {
    if (value == null) return List.of();
    try {
      return mapper.readValue(value, new TypeReference<List<Long>>() {});
    } catch (Exception ex) {
      throw new IllegalStateException("Catalog result index is invalid");
    }
  }

  public Set<String> fields(String value) {
    if (value == null) return Set.of();
    try {
      return mapper.readValue(value, new TypeReference<Set<String>>() {});
    } catch (Exception ex) {
      throw new IllegalStateException("Catalog field policy is invalid");
    }
  }

  public <T> T read(String value, Class<T> type) {
    try {
      return mapper.readValue(value, type);
    } catch (Exception ex) {
      throw new IllegalStateException("Catalog payload is invalid");
    }
  }
}
