package com.margins.book.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LibraryContinueLocator {
    String kind;
    String href;
}
