package com.margins.book.provider;

import com.margins.book.dto.BookCandidateDto;
import java.util.List;

public interface BookSearchProvider {
    default String providerName() {
        return "external";
    }

    /**
     * 페이지 검색 결과의 후보도 동일한 정규화·필수값 계약을 만족해야 한다.
     */
    default BookSearchResult search(String query, int page, int limit) {
        return BookSearchResult.builder()
            .candidates(search(query))
            .build();
    }

    /**
     * 외부 검색 데이터를 앱 규격에 맞는 non-null 후보로 정규화해 반환한다.
     * candidateId, title, author는 빈 문자열이 아니어야 한다.
     */
    List<BookCandidateDto> search(String query);
}
