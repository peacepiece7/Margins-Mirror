package com.margins.book.business;

import com.margins.auth.support.AuthContext;
import com.margins.book.dto.BookBackgroundDto;
import com.margins.book.dto.UpdateBookBackgroundRequest;
import com.margins.book.mapper.BookBackgroundMapper;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookRecord;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class BookBackgroundBusiness {
    private final BookMapper books;
    private final BookBackgroundMapper backgrounds;

    /** 인증된 독자가 소유한 활성 책의 배경 설명만 읽는다. */
    public BookBackgroundDto find(Long bookId) {
        return BookBackgroundDto.from(ownedBook(bookId, AuthContext.requireUserId()));
    }

    /** 개인 배경 설명을 버전 조건으로 갱신하며 공유 AI 원본은 변경하지 않는다. */
    public BookBackgroundDto update(Long bookId, UpdateBookBackgroundRequest request) {
        Long userId = AuthContext.requireUserId();
        ownedBook(bookId, userId);
        String summary = request.getSummary() == null ? null : request.getSummary().strip();
        if (!request.isSummaryProvided() || request.getExpectedRevision() == null || request.getExpectedRevision() < 0
            || (summary != null && (summary.isBlank() || request.getSummary().length() > 10000))) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST);
        }
        if (backgrounds.update(bookId, userId, summary, request.getExpectedRevision()) != 1) {
            // Preserve the same missing/deleted ownership boundary even if a book changed mid-request.
            ownedBook(bookId, userId);
            throw new ApiException(ApiErrorCode.COMMON_CONFLICT, "Background changed; reload before saving");
        }
        return BookBackgroundDto.from(ownedBook(bookId, userId));
    }

    /** 비소유·삭제된 책은 동일한 NOT_FOUND 경계로 처리한다. */
    private BookRecord ownedBook(Long bookId, Long userId) {
        BookRecord book = books.findByIdForUser(bookId, userId);
        if (book == null) throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND);
        return book;
    }
}
