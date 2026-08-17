package com.margins.book.event;

public record BookSavedEvent(Long bookId, Long userId) {
}
