package com.margins.book.business;

import com.margins.auth.support.AuthContext;
import com.margins.book.dto.LibraryActivitySummary;
import com.margins.book.dto.LibraryContinueLocator;
import com.margins.book.dto.LibraryLoopSummary;
import com.margins.book.dto.LibraryRevisionSummary;
import com.margins.book.dto.LibrarySummary;
import com.margins.book.dto.LibraryThreadItem;
import com.margins.book.dto.LibraryThreadResponse;
import com.margins.book.dto.SaveBookResponse;
import com.margins.book.mapper.LibraryThreadMapper;
import com.margins.book.model.BookReadingStatus;
import com.margins.book.model.BookShelfSort;
import com.margins.book.model.LibraryActivityRecord;
import com.margins.book.model.LibraryCountRecord;
import com.margins.book.model.LibraryRevisionSummaryRecord;
import com.margins.book.model.LibraryThreadRecord;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Library page, 진행 단계, aggregate summary와 continue locator를 조합한다. */
@Component
@RequiredArgsConstructor
public class LibraryThreadBusiness {

    static final int DEFAULT_LIMIT = 50;
    static final int MAX_LIMIT = 50;
    static final int INTERVIEW_TARGET_COUNT = 5;
    static final int RECENT_ACTIVITY_LIMIT = 30;
    private static final List<String> SHELF_CATEGORIES = List.of(
        "all",
        "want_to_read",
        "reading",
        "read",
        "dnf"
    );
    private static final List<String> STAGE_CATEGORIES = List.of(
        "REFLECT",
        "INTERVIEW",
        "GUIDE",
        "DISCUSS",
        "REFINE"
    );
    private static final Set<String> VALID_STAGES = Set.copyOf(STAGE_CATEGORIES);

    private final LibraryThreadMapper libraryThreadMapper;

    public LibraryThreadResponse findThreads(
        String status,
        String stage,
        String sort,
        String cursor,
        Integer requestedLimit
    ) {
        Long userId = AuthContext.requireUserId();
        String normalizedStatus = normalizeStatus(status);
        String normalizedStage = normalizeStage(stage);
        String normalizedSort = normalizeSort(sort);
        int offset = parseCursor(cursor);
        int limit = normalizeLimit(requestedLimit);

        List<LibraryThreadRecord> rows = libraryThreadMapper.findThreads(
            userId,
            normalizedStatus,
            normalizedStage,
            normalizedSort,
            limit + 1,
            offset
        );
        boolean hasMore = rows.size() > limit;
        List<LibraryThreadRecord> pageRows = hasMore ? rows.subList(0, limit) : rows;
        List<Long> bookIds = pageRows.stream().map(LibraryThreadRecord::getBookId).toList();
        Map<Long, List<LibraryRevisionSummary>> revisionsByBook = recentRevisions(userId, bookIds);

        List<LibraryThreadItem> threads = pageRows.stream()
            .map(row -> toThread(row, revisionsByBook.getOrDefault(row.getBookId(), List.of())))
            .toList();

        return LibraryThreadResponse.builder()
            .threads(threads)
            .nextCursor(hasMore ? String.valueOf(offset + limit) : null)
            .summary(offset == 0 ? summary(userId) : null)
            .build();
    }

    private LibrarySummary summary(Long userId) {
        Map<String, Long> shelfCounts = counts(SHELF_CATEGORIES, libraryThreadMapper.countByShelf(userId));
        shelfCounts.put("all", shelfCounts.entrySet().stream()
            .filter(entry -> !"all".equals(entry.getKey()))
            .mapToLong(Map.Entry::getValue)
            .sum());
        return LibrarySummary.builder()
            .shelfCounts(shelfCounts)
            .stageCounts(counts(STAGE_CATEGORIES, libraryThreadMapper.countByStage(userId)))
            .recentActivity(libraryThreadMapper.findRecentActivity(userId, RECENT_ACTIVITY_LIMIT)
                .stream()
                .map(this::toActivitySummary)
                .toList())
            .build();
    }

    private Map<String, Long> counts(List<String> categories, List<LibraryCountRecord> rows) {
        Map<String, Long> counts = new LinkedHashMap<>();
        categories.forEach(category -> counts.put(category, 0L));
        rows.forEach(row -> counts.put(row.getCategory(), row.getTotal()));
        return counts;
    }

    private LibraryActivitySummary toActivitySummary(LibraryActivityRecord record) {
        return LibraryActivitySummary.builder()
            .bookId(record.getBookId())
            .bookTitle(record.getBookTitle())
            .bookAuthor(record.getBookAuthor())
            .revisionId(record.getRevisionId())
            .version(record.getVersion())
            .revisionSource(record.getRevisionSource())
            .createdAt(format(record.getCreatedAt()))
            .build();
    }

    private Map<Long, List<LibraryRevisionSummary>> recentRevisions(Long userId, List<Long> bookIds) {
        if (bookIds.isEmpty()) {
            return Collections.emptyMap();
        }
        return libraryThreadMapper.findRecentRevisions(userId, bookIds).stream()
            .collect(Collectors.groupingBy(
                LibraryRevisionSummaryRecord::getBookId,
                Collectors.mapping(this::toRevisionSummary, Collectors.toList())
            ));
    }

    private LibraryThreadItem toThread(
        LibraryThreadRecord row,
        List<LibraryRevisionSummary> recentRevisions
    ) {
        SaveBookResponse book = SaveBookResponse.from(row.toBookRecord());
        LibraryLoopSummary loop = toLoop(row);
        return LibraryThreadItem.builder()
            .book(book)
            .loop(loop)
            .recentRevisions(recentRevisions)
            .version(rowVersion(row))
            .build();
    }

    private LibraryLoopSummary toLoop(LibraryThreadRecord row) {
        String stage = stage(row);
        return LibraryLoopSummary.builder()
            .stage(stage)
            .reflectionId(row.getReflectionId())
            .currentRevisionId(row.getCurrentRevisionId())
            .currentRevisionNumber(row.getCurrentRevisionNumber())
            .currentRevisionAt(format(row.getCurrentRevisionAt()))
            .interviewId(row.getInterviewId())
            .answeredCount(row.getAnsweredCount() == null ? 0 : row.getAnsweredCount())
            .targetCount(INTERVIEW_TARGET_COUNT)
            .guideId(row.getGuideId())
            .runId(row.getRunId())
            .runStatus(row.getRunStatus())
            .continueLocator(LibraryContinueLocator.builder()
                .kind(stage)
                .href(continueHref(row, stage))
                .build())
            .build();
    }

    private String stage(LibraryThreadRecord row) {
        if (row.getReflectionId() == null || row.getCurrentRevisionId() == null) {
            return "REFLECT";
        }
        if (row.getInterviewId() == null) {
            return "INTERVIEW";
        }
        if (row.getGuideId() == null) {
            return "INTERVIEW";
        }
        if (row.getRunId() == null) {
            return "GUIDE";
        }
        if ("COMPLETED".equals(row.getRunStatus())) {
            return "REFINE";
        }
        return "DISCUSS";
    }

    private String continueHref(LibraryThreadRecord row, String stage) {
        String bookBase = "/book/" + row.getBookId() + "/reflection";
        return switch (stage) {
            case "INTERVIEW" -> bookBase + "/interview";
            case "GUIDE" -> bookBase + "/guide/" + row.getGuideId();
            case "DISCUSS" -> bookBase + "/discuss/" + row.getRunId();
            case "REFINE" -> row.getRefinedRevisionId() == null
                ? bookBase + "/refine/" + row.getRunId()
                : bookBase;
            default -> bookBase;
        };
    }

    private LibraryRevisionSummary toRevisionSummary(LibraryRevisionSummaryRecord record) {
        return LibraryRevisionSummary.builder()
            .revisionId(record.getRevisionId())
            .version(record.getVersion())
            .revisionSource(record.getRevisionSource())
            .createdAt(format(record.getCreatedAt()))
            .build();
    }

    private String rowVersion(LibraryThreadRecord row) {
        return String.join(
            ":",
            value(format(row.getBookUpdatedAt())),
            value(row.getCurrentRevisionId()),
            value(row.getRunId()),
            value(row.getRunStatus()),
            value(format(row.getRunUpdatedAt()))
        );
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank() || "all".equalsIgnoreCase(status.trim())) {
            return null;
        }
        String normalized = BookReadingStatus.normalize(status);
        if (!BookReadingStatus.isValid(normalized)) {
            throw badRequest("Library status filter is invalid");
        }
        return normalized;
    }

    private String normalizeSort(String sort) {
        if (!BookShelfSort.isValid(sort)) {
            throw badRequest("Library sort is invalid");
        }
        return BookShelfSort.normalize(sort);
    }

    private String normalizeStage(String stage) {
        if (stage == null || stage.isBlank()) {
            return null;
        }
        String normalized = stage.trim().toUpperCase(Locale.ROOT);
        if (!VALID_STAGES.contains(normalized)) {
            throw badRequest("Library stage filter is invalid");
        }
        return normalized;
    }

    private int parseCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            int offset = Integer.parseInt(cursor);
            if (offset < 0) {
                throw badRequest("Library cursor is invalid");
            }
            return offset;
        } catch (NumberFormatException exception) {
            throw badRequest("Library cursor is invalid");
        }
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw badRequest("Library limit must be between 1 and " + MAX_LIMIT);
        }
        return limit;
    }

    private ApiException badRequest(String message) {
        return new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, message);
    }

    private String format(LocalDateTime value) {
        return value == null ? null : value.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }

    private String value(Object value) {
        return value == null ? "-" : value.toString();
    }
}
