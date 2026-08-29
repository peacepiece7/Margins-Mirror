package com.margins.book.dto;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BookKnowledgeDto {
    Long knowledgeId;
    String isbn;
    String title;
    String author;
    String summary;
    List<String> themes;
    List<DiscussionPointDto> discussionPoints;
    List<RecommendedPersonaDto> recommendedPersonas;
    List<String> famousQuotes;
    List<String> keywords;
    String version;
    String generationLocale;
    String status;
    String generatedAt;
    boolean stale;
    boolean fallbackUsed;
    boolean refreshPending;

    @Value
    @Builder
    public static class DiscussionPointDto {
        String id;
        String question;
        String rationale;
        List<String> recommendedPersonaKeys;
    }

    @Value
    @Builder
    public static class RecommendedPersonaDto {
        String discussionPointId;
        List<String> personaKeys;
    }
}
