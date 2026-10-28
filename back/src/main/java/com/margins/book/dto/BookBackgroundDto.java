package com.margins.book.dto;

import com.margins.book.model.BookRecord;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BookBackgroundDto {
    String summary;
    int revision;
    String updatedAt;

    /** 개인 설명과 수정 버전만 API 모델로 변환한다. */
    public static BookBackgroundDto from(BookRecord book) {
        return BookBackgroundDto.builder()
            .summary(book.getBackgroundSummary())
            .revision(book.getBackgroundRevision())
            .updatedAt(book.getBackgroundUpdatedAt() == null
                ? null : book.getBackgroundUpdatedAt().toString())
            .build();
    }
}
