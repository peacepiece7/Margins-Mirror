package com.margins.book.catalog.business;

import com.margins.auth.support.AuthContext;
import com.margins.book.catalog.dto.CatalogDto.*;
import com.margins.book.catalog.mapper.CatalogLibraryMapper;
import com.margins.book.dto.*;
import com.margins.book.mapper.BookMapper;
import com.margins.book.service.BookService;
import com.margins.common.error.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class CatalogSaveBusiness {
  private final CatalogSearchBusiness search;
  private final BookMapper books;
  private final CatalogLibraryMapper library;
  private final BookService bookService;

  @Transactional
  public SaveBookResponse save(SaveRequest request) {
    long userId = AuthContext.requireUserId();
    Boolean testData = books.lockUser(userId);
    if (testData == null) throw new ApiException(ApiErrorCode.COMMON_UNAUTHORIZED);
    var candidate = search.detail(request.catalogBookId());
    if (candidate.inLibrary()) throw new ApiException(ApiErrorCode.BOOK_ALREADY_EXISTS);
    var result =
        bookService.saveBook(
            SaveBookRequest.builder()
                .candidateId(candidate.candidateId())
                .title(candidate.title())
                .subtitle(candidate.subtitle())
                .author(candidate.author().isBlank() ? "Unknown author" : candidate.author())
                .authors(candidate.authors())
                .publisher(candidate.publisher())
                .isbn13(candidate.isbn13())
                .publishedDate(candidate.publishedDate())
                .publishedYear(candidate.publishedYear())
                .language(candidate.language())
                .pageCount(candidate.pageCount())
                .description(candidate.description())
                .thumbnail(candidate.thumbnail())
                .build());
    library.attach(result.getBookId(), userId, candidate.catalogBookId(), testData);
    return result;
  }
}
