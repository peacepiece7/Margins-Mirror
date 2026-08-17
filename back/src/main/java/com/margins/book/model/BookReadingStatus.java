package com.margins.book.model;

import java.util.Set;

public final class BookReadingStatus {

    public static final String WANT_TO_READ = "want_to_read";
    public static final String READING = "reading";
    public static final String READ = "read";
    public static final String DNF = "dnf";

    private static final Set<String> VALID = Set.of(WANT_TO_READ, READING, READ, DNF);

    private BookReadingStatus() {
    }

    public static boolean isValid(String value) {
        return value != null && VALID.contains(value.trim().toLowerCase());
    }

    public static String normalize(String value) {
        if (value == null) {
            return null;
        }
        return value.trim().toLowerCase();
    }
}
