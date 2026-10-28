package com.margins.book.service;

import com.margins.book.business.BookBackgroundBusiness;
import com.margins.book.dto.BookBackgroundDto;
import com.margins.book.dto.UpdateBookBackgroundRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BookBackgroundService {
    private final BookBackgroundBusiness background;

    /** 읽기 전용 트랜잭션에서 개인 배경 설명을 조회한다. */
    @Transactional(readOnly = true)
    public BookBackgroundDto find(Long bookId) {
        return background.find(bookId);
    }

    /** 소유권 확인과 조건부 저장 및 반환을 한 트랜잭션으로 묶는다. */
    @Transactional
    public BookBackgroundDto update(Long bookId, UpdateBookBackgroundRequest request) {
        return background.update(bookId, request);
    }
}
