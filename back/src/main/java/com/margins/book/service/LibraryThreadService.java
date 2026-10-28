package com.margins.book.service;

import com.margins.book.business.LibraryThreadBusiness;
import com.margins.book.dto.LibraryThreadResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Library thread 읽기 요청을 트랜잭션 경계 안에서 업무 계층으로 전달한다. */
@Service
@RequiredArgsConstructor
public class LibraryThreadService {

    private final LibraryThreadBusiness libraryThreadBusiness;

    @Transactional(readOnly = true)
    public LibraryThreadResponse findThreads(
        String status,
        String stage,
        String sort,
        String cursor,
        Integer limit
    ) {
        return libraryThreadBusiness.findThreads(status, stage, sort, cursor, limit);
    }
}
