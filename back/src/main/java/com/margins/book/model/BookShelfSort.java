package com.margins.book.model;

import java.util.Set;

public final class BookShelfSort {

    public static final String RECENT = "recent";
    public static final String TITLE_ASC = "title_asc";
    public static final String TITLE_DESC = "title_desc";
    public static final String RATING_DESC = "rating_desc";
    public static final String RATING_ASC = "rating_asc";
    public static final String STATUS = "status";

    private static final Set<String> VALID = Set.of(
        RECENT,
        TITLE_ASC,
        TITLE_DESC,
        RATING_DESC,
        RATING_ASC,
        STATUS
    );

    private BookShelfSort() {
    }

    public static boolean isValid(String value) {
        return value == null || value.isBlank() || VALID.contains(value.trim().toLowerCase());
    }

    public static String normalize(String value) {
        if (value == null || value.isBlank()) {
            return RECENT;
        }
        return value.trim().toLowerCase();
    }
}
