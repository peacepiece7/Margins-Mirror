package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.margins.book.business.BookBusiness;
import com.margins.book.dto.BookCandidateDto;
import com.margins.book.dto.BookCandidateSearchRequest;
import com.margins.book.dto.BookCandidateSearchResponse;
import com.margins.book.dto.BookListResponse;
import com.margins.book.dto.SaveBookRequest;
import com.margins.book.dto.SaveBookResponse;
import com.margins.book.dto.UpdateBookRequest;
import com.margins.book.dto.UpdateBookShelfRequest;
import com.margins.book.mapper.BookMapper;
import com.margins.book.model.BookRecord;
import com.margins.book.provider.BookSearchProvider;
import com.margins.book.provider.BookSearchProperties;
import com.margins.book.provider.BookSearchResult;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.testsupport.TestSecurityContextSupport;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class BookBusinessPersistenceTest {

    @Test
    void saveBookResponseMapsRecordWithDefaultStatusAndIsoTimestamps() {
        SaveBookResponse response = SaveBookResponse.from(BookRecord.builder()
            .id(7L)
            .title("Shelf Book")
            .statusStartedAt(LocalDateTime.of(2026, 8, 11, 9, 30, 15))
            .statusFinishedAt(LocalDateTime.of(2026, 8, 12, 10, 45))
            .updatedAt(LocalDateTime.of(2026, 8, 13, 11, 20, 30))
            .build());

        assertThat(response.getBookId()).isEqualTo(7L);
        assertThat(response.getReadingStatus()).isEqualTo("want_to_read");
        assertThat(response.getStatusStartedAt()).isEqualTo("2026-08-11T09:30:15");
        assertThat(response.getStatusFinishedAt()).isEqualTo("2026-08-12T10:45:00");
        assertThat(response.getUpdatedAt()).isEqualTo("2026-08-13T11:20:30");
    }

    @Test
    void saveBookPersistsAndReturnsGeneratedId() {
        FakeBookMapper mapper = new FakeBookMapper();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        SaveBookResponse response = business.saveBook(SaveBookRequest.builder()
            .candidateId("candidate-1")
            .title("  Persisted Book  ")
            .subtitle("  A Field Guide  ")
            .author("  Reader  ")
            .authors(List.of("  Reader  ", "Co Reader"))
            .publisher("  Margins Press  ")
            .publishedDate("  2026-07-02  ")
            .isbn("  9788996991342  ")
            .isbn10("  8996991341  ")
            .isbn13("  9788996991342  ")
            .publishedYear(2026)
            .description("  Provider description  ")
            .thumbnail("  https://books.example/cover.jpg  ")
            .language("  ko  ")
            .pageCount(304)
            .build());

        assertThat(response.getBookId()).isEqualTo(42L);
        assertThat(response.getTitle()).isEqualTo("Persisted Book");
        assertThat(response.getSubtitle()).isEqualTo("A Field Guide");
        assertThat(response.getPublisher()).isEqualTo("Margins Press");
        assertThat(response.getPublishedYear()).isEqualTo(2026);
        assertThat(response.getIsbn()).isEqualTo("9788996991342");
        assertThat(response.getCoverImageUrl()).isEqualTo("https://books.example/cover.jpg");
        assertThat(response.getLanguage()).isEqualTo("ko");
        assertThat(mapper.inserted.getUserId()).isEqualTo(1L);
        assertThat(mapper.inserted.getSubtitle()).isEqualTo("A Field Guide");
        assertThat(mapper.inserted.getPublisher()).isEqualTo("Margins Press");
        assertThat(mapper.inserted.getIsbn()).isEqualTo("9788996991342");
        assertThat(mapper.inserted.getLanguageCode()).isEqualTo("ko");
        assertThat(mapper.inserted.getDescription()).isEqualTo("Provider description");
        assertThat(mapper.inserted.getCoverImageUrl()).isEqualTo("https://books.example/cover.jpg");
        assertThat(mapper.inserted.getSource()).isEqualTo("ai");
        assertThat(mapper.inserted.getSourceRef()).isEqualTo("candidate-1");
        assertThat(mapper.inserted.getRawMetadata())
            .contains("\"providerMetadata\"")
            .contains("\"isbn13\":\"9788996991342\"")
            .contains("\"pageCount\":304")
            .contains("\"aiProfile\"")
            .contains("\"isbn\":\"9788996991342\"")
            .contains("\"discussionAngles\"")
            .contains("\"confidence\":\"low\"");
        assertThat(mapper.inserted.getReadingStatus()).isEqualTo("want_to_read");
    }

    @Test
    void updateBookShelfPersistsStatusRatingAndTimestamps() {
        FakeBookMapper mapper = new FakeBookMapper();
        mapper.bookById = BookRecord.builder()
            .id(7L)
            .userId(1L)
            .title("Shelf Book")
            .author("Reader")
            .readingStatus("want_to_read")
            .build();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        SaveBookResponse response = business.updateBookShelf(7L, UpdateBookShelfRequest.builder()
            .readingStatus("reading")
            .rating(4.5)
            .build());

        assertThat(response.getReadingStatus()).isEqualTo("reading");
        assertThat(response.getRating()).isEqualTo(4.5);
        assertThat(mapper.bookById.getStatusStartedAt()).isNotNull();
    }

    @Test
    void updateBookShelfRejectsNonHalfStepRating() {
        FakeBookMapper mapper = new FakeBookMapper();
        mapper.bookById = BookRecord.builder()
            .id(7L)
            .userId(1L)
            .title("Shelf Book")
            .author("Reader")
            .readingStatus("want_to_read")
            .build();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        assertThatThrownBy(() -> business.updateBookShelf(7L, UpdateBookShelfRequest.builder()
            .rating(4.3)
            .build()))
            .isInstanceOf(ResponseStatusException.class)
            .extracting("statusCode")
            .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void findSavedBooksDelegatesFilterAndSortToMapper() {
        FakeBookMapper mapper = new FakeBookMapper() {
            @Override
            public List<BookRecord> findByUserId(Long userId, String statusFilter, String sort) {
                this.shelfStatusFilter = statusFilter;
                this.shelfSort = sort;
                return List.of(
                    BookRecord.builder().id(3L).userId(userId).title("C Book").author("A").readingStatus("reading").rating(4.0).build(),
                    BookRecord.builder().id(2L).userId(userId).title("A Book").author("A").readingStatus("reading").rating(5.0).build()
                );
            }
        };
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        BookListResponse filtered = business.findSavedBooks(" READING ", " RATING_DESC ");

        assertThat(mapper.shelfStatusFilter).isEqualTo("reading");
        assertThat(mapper.shelfSort).isEqualTo("rating_desc");
        assertThat(filtered.getBooks()).extracting(SaveBookResponse::getBookId).containsExactly(3L, 2L);
    }

    @Test
    void updateBookShelfRejectsInvalidStatus() {
        FakeBookMapper mapper = new FakeBookMapper();
        mapper.bookById = BookRecord.builder().id(7L).userId(1L).title("Shelf Book").author("Reader").build();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        assertThatThrownBy(() -> business.updateBookShelf(7L, UpdateBookShelfRequest.builder()
            .readingStatus("invalid")
            .build()))
            .isInstanceOf(ResponseStatusException.class)
            .extracting("statusCode")
            .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void saveBookPersistsProviderSourceFromCandidateIdPrefix() {
        FakeBookMapper mapper = new FakeBookMapper();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        business.saveBook(SaveBookRequest.builder()
            .candidateId("google:9788996991342")
            .title("미움받을 용기")
            .author("기시미 이치로, 고가 후미타케")
            .publishedYear(2014)
            .build());

        assertThat(mapper.inserted.getSource()).isEqualTo("google");
        assertThat(mapper.inserted.getSourceRef()).isEqualTo("google:9788996991342");
        assertThat(mapper.inserted.getRawMetadata()).contains("\"provider\":\"google\"");
    }

    @Test
    void saveBookRejectsExistingBookWithSameIsbn() {
        FakeBookMapper mapper = new FakeBookMapper();
        mapper.duplicate = BookRecord.builder()
            .id(99L)
            .userId(1L)
            .title("Dune")
            .author("AI Candidate")
            .isbn("9780441478125")
            .build();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        assertThatThrownBy(() -> business.saveBook(SaveBookRequest.builder()
            .candidateId("candidate-duplicate")
            .title("Different title")
            .author("Different author")
            .isbn("978-0441478125")
            .publishedYear(1965)
            .build()))
            .isInstanceOfSatisfying(ApiException.class, (exception) -> {
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.BOOK_ALREADY_EXISTS);
            });

        assertThat(mapper.inserted).isNull();
        assertThat(mapper.duplicateLookupIsbn).isEqualTo("9780441478125");
    }

    @Test
    void saveBookAllowsBooksWithoutIsbnWithoutDuplicateLookup() {
        FakeBookMapper mapper = new FakeBookMapper();
        mapper.duplicate = BookRecord.builder()
            .id(99L)
            .userId(1L)
            .title("Same title")
            .author("Same author")
            .build();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        business.saveBook(SaveBookRequest.builder()
            .candidateId("manual-1")
            .title("Same title")
            .author("Same author")
            .build());

        assertThat(mapper.inserted).isNotNull();
        assertThat(mapper.duplicateLookupIsbn).isNull();
    }

    @Test
    void saveBookUsesIsbn13WhenCanonicalIsbnIsAbsent() {
        FakeBookMapper mapper = new FakeBookMapper();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        business.saveBook(SaveBookRequest.builder()
            .candidateId("google:9780441478125")
            .title("Dune")
            .author("Frank Herbert")
            .isbn13("978-0441478125")
            .build());

        assertThat(mapper.duplicateLookupIsbn).isEqualTo("9780441478125");
        assertThat(mapper.inserted.getIsbn()).isEqualTo("9780441478125");
    }

    @Test
    void saveBookRejectsZeroRowInsert() {
        FakeBookMapper mapper = new FakeBookMapper();
        mapper.insertRows = 0;
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        assertThatThrownBy(() -> business.saveBook(SaveBookRequest.builder()
            .candidateId("candidate-zero")
            .title("Zero Row Book")
            .author("Reader")
            .build()))
            .isInstanceOfSatisfying(ResponseStatusException.class, (exception) -> {
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                assertThat(exception.getReason()).isEqualTo("Book could not be saved");
            });
    }

    @Test
    void findSavedBooksReturnsUserBooks() {
        BookBusiness business = business(new EmptyBookSearchProvider(), new FakeBookMapper());

        assertThat(business.findSavedBooks(null, null).getBooks())
            .extracting(SaveBookResponse::getTitle)
            .containsExactly("Saved Book");
    }

    @Test
    void updateBookTrimsAndPersistsEditableMetadata() {
        FakeBookMapper mapper = new FakeBookMapper();
        mapper.bookById = BookRecord.builder()
            .id(43L)
            .userId(1L)
            .title("Before")
            .author("Old")
            .source("google")
            .sourceRef("google:9780441478125")
            .isbn("9780441478125")
            .languageCode("en")
            .rawMetadata("{\"providerMetadata\":{\"provider\":\"google\",\"candidateId\":\"google:9780441478125\",\"isbn13\":\"9780441478125\",\"publisher\":\"Ace\",\"thumbnail\":\"https://books.example/cover.jpg\",\"pageCount\":304},\"aiProfile\":{\"title\":\"Before\",\"author\":\"Old\"}}")
            .build();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        SaveBookResponse response = business.updateBook(43L, UpdateBookRequest.builder()
            .title("  Updated Book  ")
            .author("  Updated Author  ")
            .publishedYear(2026)
            .build());

        assertThat(response.getTitle()).isEqualTo("Updated Book");
        assertThat(mapper.updated.getTitle()).isEqualTo("Updated Book");
        assertThat(mapper.updated.getAuthor()).isEqualTo("Updated Author");
        assertThat(mapper.updated.getPublishedYear()).isEqualTo(2026);
        assertThat(mapper.updated.getRawMetadata())
            .contains("\"providerMetadata\"")
            .contains("\"candidateId\":\"google:9780441478125\"")
            .contains("\"isbn13\":\"9780441478125\"")
            .contains("\"thumbnail\":\"https://books.example/cover.jpg\"")
            .contains("\"pageCount\":304")
            .contains("\"title\":\"Updated Book\"")
            .contains("\"author\":\"Updated Author\"")
            .contains("\"publishedYear\":2026")
            .doesNotContain("Before")
            .doesNotContain("Old");
    }

    @Test
    void updateBookRejectsAnotherBookWithSameIsbn() {
        FakeBookMapper mapper = new FakeBookMapper();
        mapper.bookById = BookRecord.builder()
            .id(43L)
            .userId(1L)
            .title("Before")
            .author("Old")
            .isbn("9780441478125")
            .build();
        mapper.duplicate = BookRecord.builder()
            .id(99L)
            .userId(1L)
            .isbn("9780441478125")
            .build();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        assertThatThrownBy(() -> business.updateBook(43L, UpdateBookRequest.builder()
            .title("Updated")
            .author("Reader")
            .build()))
            .isInstanceOfSatisfying(ApiException.class, (exception) -> {
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.BOOK_ALREADY_EXISTS);
            });

        assertThat(mapper.updated).isNull();
        assertThat(mapper.duplicateLookupIsbn).isEqualTo("9780441478125");
    }

    @Test
    void deleteBookSoftDeletesWithoutReadingTheBookOrRefreshingTheList() {
        FakeBookMapper mapper = new FakeBookMapper();
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        business.deleteBook(43L);

        assertThat(mapper.deletedBookId).isEqualTo(43L);
        assertThat(mapper.findByIdCalls).isZero();
    }

    @Test
    void deleteBookTreatsAnUnchangedSoftDeleteAsNotFound() {
        FakeBookMapper mapper = new FakeBookMapper();
        mapper.deleteRows = 0;
        BookBusiness business = business(new EmptyBookSearchProvider(), mapper);

        assertThatThrownBy(() -> business.deleteBook(43L))
            .isInstanceOfSatisfying(ApiException.class, (exception) -> {
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(exception.getCode()).isEqualTo(ApiErrorCode.COMMON_NOT_FOUND);
            });
    }

    @Test
    void searchCandidatesReturnsProviderCandidatesWithoutRebuildingThem() {
        BookCandidateDto candidate = BookCandidateDto.builder()
            .candidateId("openlibrary:/works/OL27448W")
            .title("Dune")
            .author("Frank Herbert")
            .build();
        BookBusiness business = business(new FixedBookSearchProvider(List.of(candidate)), new FakeBookMapper());

        BookCandidateSearchResponse response = business.searchCandidates(BookCandidateSearchRequest.builder()
            .query("long candidate")
            .build());

        assertThat(response.getCandidates()).singleElement().isSameAs(candidate);
    }

    @Test
    void searchCandidatesPrefersExternalBookApiResults() {
        BookBusiness business = business(
            new FixedBookSearchProvider(List.of(BookCandidateDto.builder()
                .candidateId("openlibrary:/works/OL27448W")
                .title("Dune")
                .author("Frank Herbert")
                .publishedYear(1965)
                .reason("Open Library search result")
                .build())),
            new FakeBookMapper()
        );

        BookCandidateSearchResponse response = business.searchCandidates(BookCandidateSearchRequest.builder()
            .query("Dune")
            .build());

        assertThat(response.getCandidates()).singleElement()
            .satisfies((candidate) -> {
                assertThat(candidate.getCandidateId()).isEqualTo("openlibrary:/works/OL27448W");
                assertThat(candidate.getTitle()).isEqualTo("Dune");
                assertThat(candidate.getAuthor()).isEqualTo("Frank Herbert");
                assertThat(candidate.getPublishedYear()).isEqualTo(1965);
            });
    }

    @Test
    void searchCandidatesPassesPaginationToExternalProvider() {
        BookSearchProperties properties = new BookSearchProperties();
        properties.setProvider("google");
        properties.setLimit(5);
        RecordingBookSearchProvider provider = new RecordingBookSearchProvider(
                "google",
                BookSearchResult.builder()
                .totalItems(23)
                .candidates(List.of(BookCandidateDto.builder()
                    .candidateId("google:9780441172719")
                    .title("Dune Messiah")
                    .author("Frank Herbert")
                    .build()))
                .build()
        );
        BookBusiness business = new BookBusiness(
            List.of(provider),
            properties,
            new FakeBookMapper()
        );

        BookCandidateSearchResponse response = business.searchCandidates(BookCandidateSearchRequest.builder()
            .query("dune")
            .page(2)
            .limit(10)
            .build());

        assertThat(provider.page).isEqualTo(2);
        assertThat(provider.limit).isEqualTo(10);
        assertThat(response.getPage()).isEqualTo(2);
        assertThat(response.getLimit()).isEqualTo(10);
        assertThat(response.getTotalItems()).isEqualTo(23);
        assertThat(response.getHasMore()).isTrue();
    }

    @Test
    void searchCandidatesUsesValidatedMaximumPageForProviderAndHasMoreCalculation() {
        BookSearchProperties properties = new BookSearchProperties();
        properties.setProvider("google");
        RecordingBookSearchProvider provider = new RecordingBookSearchProvider(
                "google",
                BookSearchResult.builder()
                .totalItems(Integer.MAX_VALUE)
                .candidates(List.of(BookCandidateDto.builder()
                    .candidateId("google:overflow-safe")
                    .title("Overflow Safe")
                    .author("Search Provider")
                    .build()))
                .build()
        );
        BookBusiness business = new BookBusiness(
            List.of(provider),
            properties,
            new FakeBookMapper()
        );

        BookCandidateSearchResponse response = business.searchCandidates(BookCandidateSearchRequest.builder()
            .query("dune")
            .page(1000)
            .limit(40)
            .build());

        assertThat(provider.page).isEqualTo(1000);
        assertThat(response.getPage()).isEqualTo(1000);
        assertThat(response.getHasMore()).isTrue();
    }

    @Test
    void searchCandidatesKeepsPagedProviderWhenLaterPageIsEmpty() {
        BookSearchProperties properties = new BookSearchProperties();
        properties.setProvider("google");
        BookBusiness business = new BookBusiness(
            List.of(
                new RecordingBookSearchProvider(
                        "google",
                        BookSearchResult.builder()
                        .totalItems(12)
                        .candidates(List.of())
                        .build()
                ),
                new NamedBookSearchProvider("openlibrary", List.of(BookCandidateDto.builder()
                    .candidateId("openlibrary:/works/OL27448W")
                    .title("Dune")
                    .author("Frank Herbert")
                    .build()))
            ),
            properties,
            new FakeBookMapper()
        );

        BookCandidateSearchResponse response = business.searchCandidates(BookCandidateSearchRequest.builder()
            .query("dune")
            .page(3)
            .limit(5)
            .build());

        assertThat(response.getCandidates()).isEmpty();
        assertThat(response.getTotalItems()).isEqualTo(12);
        assertThat(response.getHasMore()).isFalse();
    }

    @Test
    void searchCandidatesUsesConfiguredProviderBeforeFallbackProviders() {
        BookSearchProperties properties = new BookSearchProperties();
        properties.setProvider("google");
        BookBusiness business = new BookBusiness(
            List.of(
                new NamedBookSearchProvider("openlibrary", List.of(BookCandidateDto.builder()
                    .candidateId("openlibrary:/works/OL27448W")
                    .title("Dune")
                    .author("Frank Herbert")
                    .publishedYear(1965)
                    .build())),
                new NamedBookSearchProvider("google", List.of(BookCandidateDto.builder()
                    .candidateId("google:9788996991342")
                    .title("미움받을 용기")
                    .author("기시미 이치로, 고가 후미타케")
                    .publishedYear(2014)
                    .build()))
            ),
            properties,
            new FakeBookMapper()
        );

        BookCandidateSearchResponse response = business.searchCandidates(BookCandidateSearchRequest.builder()
            .query("미움받을 용기")
            .build());

        assertThat(response.getCandidates()).singleElement()
            .satisfies((candidate) -> {
                assertThat(candidate.getCandidateId()).isEqualTo("google:9788996991342");
                assertThat(candidate.getTitle()).isEqualTo("미움받을 용기");
                assertThat(candidate.getAuthor()).isEqualTo("기시미 이치로, 고가 후미타케");
            });
    }

    @Test
    void searchCandidatesFallsBackToNextProviderWhenPreferredReturnsEmpty() {
        BookSearchProperties properties = new BookSearchProperties();
        properties.setProvider("google");
        BookBusiness business = new BookBusiness(
            List.of(
                new NamedBookSearchProvider("google", List.of()),
                new NamedBookSearchProvider("openlibrary", List.of(BookCandidateDto.builder()
                    .candidateId("openlibrary:/works/OL27448W")
                    .title("Dune")
                    .author("Frank Herbert")
                    .publishedYear(1965)
                    .build()))
            ),
            properties,
            new FakeBookMapper()
        );

        BookCandidateSearchResponse response = business.searchCandidates(BookCandidateSearchRequest.builder()
            .query("dune")
            .build());

        assertThat(response.getCandidates()).singleElement()
            .satisfies((candidate) -> {
                assertThat(candidate.getCandidateId()).isEqualTo("openlibrary:/works/OL27448W");
                assertThat(candidate.getTitle()).isEqualTo("Dune");
                assertThat(candidate.getAuthor()).isEqualTo("Frank Herbert");
            });
    }

    @Test
    void searchCandidatesFallsBackToOpenLibraryForKoreanQueryWhenGoogleReturnsEmpty() {
        BookSearchProperties properties = new BookSearchProperties();
        properties.setProvider("google");
        BookBusiness business = new BookBusiness(
            List.of(
                new NamedBookSearchProvider("google", List.of()),
                new NamedBookSearchProvider("openlibrary", List.of(BookCandidateDto.builder()
                    .candidateId("openlibrary:/works/OL12345W")
                    .title("미움받을 용기")
                    .author("기시미 이치로, 고가 후미타케")
                    .publishedYear(2014)
                    .build()))
            ),
            properties,
            new FakeBookMapper()
        );

        BookCandidateSearchResponse response = business.searchCandidates(BookCandidateSearchRequest.builder()
            .query("미움받을 용기")
            .build());

        assertThat(response.getCandidates()).singleElement()
            .satisfies((candidate) -> {
                assertThat(candidate.getCandidateId()).isEqualTo("openlibrary:/works/OL12345W");
                assertThat(candidate.getTitle()).isEqualTo("미움받을 용기");
                assertThat(candidate.getAuthor()).isEqualTo("기시미 이치로, 고가 후미타케");
            });
    }

    @Test
    void searchCandidatesReturnsEmptyForUnmatchedIsbnWithoutAiFallback() {
        BookSearchProperties properties = new BookSearchProperties();
        properties.setProvider("google");
        BookBusiness business = new BookBusiness(
            List.of(
                new NamedBookSearchProvider("google", List.of()),
                new NamedBookSearchProvider("openlibrary", List.of())
            ),
            properties,
            new FakeBookMapper()
        );

        BookCandidateSearchResponse response = business.searchCandidates(BookCandidateSearchRequest.builder()
            .query("isbn:9780000000000")
            .build());

        assertThat(response.getCandidates()).isEmpty();
        assertThat(response.getTotalItems()).isZero();
        assertThat(response.getHasMore()).isFalse();
    }

    private BookBusiness business(BookSearchProvider bookSearchProvider, BookMapper bookMapper) {
        return business(List.of(bookSearchProvider), bookMapper);
    }

    private BookBusiness business(List<BookSearchProvider> bookSearchProviders, BookMapper bookMapper) {
        BookSearchProperties properties = new BookSearchProperties();
        properties.setProvider("openlibrary");
        return new BookBusiness(bookSearchProviders, properties, bookMapper);
    }

    private static class FakeBookMapper implements BookMapper {
        private BookRecord inserted;
        private BookRecord updated;
        private BookRecord enriched;
        private BookRecord duplicate;
        private BookRecord bookById;
        private Long deletedBookId;
        private int findByIdCalls;
        private int deleteRows = 1;
        private String duplicateLookupIsbn;
        protected String shelfStatusFilter;
        protected String shelfSort;
        private int insertRows = 1;

        @Override
        public int insert(BookRecord record) {
            this.inserted = record;
            record.setId(42L);
            return insertRows;
        }

        @Override
        public BookRecord findDuplicateByIsbn(Long userId, String isbn) {
            this.duplicateLookupIsbn = isbn;
            return duplicate;
        }

        @Override
        public List<BookRecord> findByUserId(Long userId, String statusFilter, String sort) {
            this.shelfStatusFilter = statusFilter;
            this.shelfSort = sort;
            return List.of(BookRecord.builder()
                .id(43L)
                .userId(userId)
                .title("Saved Book")
                .author("Saved Author")
                .build());
        }

        @Override
        public BookRecord findByIdForUser(Long bookId, Long userId) {
            findByIdCalls++;
            return bookById;
        }

        @Override
        public int update(BookRecord record) {
            this.updated = record;
            this.bookById = record;
            return 1;
        }

        @Override
        public int updateShelf(BookRecord record) {
            if (bookById != null) {
                bookById.setReadingStatus(record.getReadingStatus());
                bookById.setRating(record.getRating());
                bookById.setStatusStartedAt(record.getStatusStartedAt());
                bookById.setStatusFinishedAt(record.getStatusFinishedAt());
            }
            return 1;
        }

        @Override
        public int fillMissingProviderMetadata(BookRecord record) {
            this.enriched = record;
            if (bookById == null) {
                bookById = duplicate;
            }
            if (bookById != null) {
                if (bookById.getSubtitle() == null || bookById.getSubtitle().isBlank()) {
                    bookById.setSubtitle(record.getSubtitle());
                }
                if (bookById.getPublisher() == null || bookById.getPublisher().isBlank()) {
                    bookById.setPublisher(record.getPublisher());
                }
                if (bookById.getIsbn() == null || bookById.getIsbn().isBlank()) {
                    bookById.setIsbn(record.getIsbn());
                }
                if (bookById.getPublishedYear() == null) {
                    bookById.setPublishedYear(record.getPublishedYear());
                }
                if (bookById.getLanguageCode() == null || bookById.getLanguageCode().isBlank()) {
                    bookById.setLanguageCode(record.getLanguageCode());
                }
                if (bookById.getDescription() == null || bookById.getDescription().isBlank()) {
                    bookById.setDescription(record.getDescription());
                }
                boolean externalUpgrade = !"ai".equals(record.getSource())
                    && (bookById.getSource() == null
                        || bookById.getSource().isBlank()
                        || "ai".equals(bookById.getSource())
                        || bookById.getSourceRef() == null
                        || bookById.getSourceRef().isBlank()
                        || bookById.getSourceRef().startsWith("manual-"));
                if ((bookById.getSource() == null || bookById.getSource().isBlank() || "ai".equals(bookById.getSource()))
                    && !"ai".equals(record.getSource())) {
                    bookById.setSource(record.getSource());
                }
                if (externalUpgrade || bookById.getSourceRef() == null || bookById.getSourceRef().isBlank()) {
                    bookById.setSourceRef(record.getSourceRef());
                }
                if (bookById.getCoverImageUrl() == null || bookById.getCoverImageUrl().isBlank()) {
                    bookById.setCoverImageUrl(record.getCoverImageUrl());
                }
                if (externalUpgrade || bookById.getRawMetadata() == null || bookById.getRawMetadata().isBlank()) {
                    bookById.setRawMetadata(record.getRawMetadata());
                }
            }
            return 1;
        }

        @Override
        public int softDelete(Long bookId, Long userId) {
            this.deletedBookId = bookId;
            return deleteRows;
        }
    }

    private static class EmptyBookSearchProvider implements BookSearchProvider {
        @Override
        public List<BookCandidateDto> search(String query) {
            return List.of();
        }
    }

    private static class FixedBookSearchProvider implements BookSearchProvider {
        private final List<BookCandidateDto> candidates;

        private FixedBookSearchProvider(List<BookCandidateDto> candidates) {
            this.candidates = candidates;
        }

        @Override
        public String providerName() {
            return "openlibrary";
        }

        @Override
        public List<BookCandidateDto> search(String query) {
            return candidates;
        }
    }

    private static class NamedBookSearchProvider implements BookSearchProvider {
        private final String providerName;
        private final List<BookCandidateDto> candidates;

        private NamedBookSearchProvider(String providerName, List<BookCandidateDto> candidates) {
            this.providerName = providerName;
            this.candidates = candidates;
        }

        @Override
        public String providerName() {
            return providerName;
        }

        @Override
        public List<BookCandidateDto> search(String query) {
            return candidates;
        }
    }

    private static class RecordingBookSearchProvider implements BookSearchProvider {
        private final String providerName;
        private final BookSearchResult result;
        private int page;
        private int limit;

        private RecordingBookSearchProvider(String providerName, BookSearchResult result) {
            this.providerName = providerName;
            this.result = result;
        }

        @Override
        public String providerName() {
            return providerName;
        }

        @Override
        public BookSearchResult search(String query, int page, int limit) {
            this.page = page;
            this.limit = limit;
            return result;
        }

        @Override
        public List<BookCandidateDto> search(String query) {
            return result.getCandidates();
        }
    }
}
