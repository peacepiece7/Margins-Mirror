package com.margins.session.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SessionWindowContext {
    private Long id;
    private Long sessionId;
    private Long userId;
    private Long bookId;
    private String bookTitle;
    private String bookAuthor;
    private String bookIsbn;
    private String bookRawMetadata;
    private String bookReadingStatus;
    private Double bookRating;
    private String windowContextSnapshot;
    private Long sourceQuestionId;
    private String sourceQuestionText;
    private String sourceQuestionAnswer;
    private Long reflectionInsightId;
    private String reflectionContent;
    private boolean testData;

    public SessionWindowContext(Long id, Long sessionId, Long userId) {
        this.id = id;
        this.sessionId = sessionId;
        this.userId = userId;
    }

    public SessionWindowContext(
        Long id,
        Long sessionId,
        Long userId,
        Long bookId,
        String bookTitle,
        String bookAuthor,
        String bookIsbn,
        String bookRawMetadata
    ) {
        this.id = id;
        this.sessionId = sessionId;
        this.userId = userId;
        this.bookId = bookId;
        this.bookTitle = bookTitle;
        this.bookAuthor = bookAuthor;
        this.bookIsbn = bookIsbn;
        this.bookRawMetadata = bookRawMetadata;
    }
}
