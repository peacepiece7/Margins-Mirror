package com.margins.memorycard.business;

import com.margins.auth.support.AuthContext;
import com.margins.book.mapper.BookMapper;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.memorycard.dto.BulkMemoryCardGroupRequest;
import com.margins.memorycard.dto.BulkMemoryCardRequest;
import com.margins.memorycard.dto.CreateMemoryCardGroupRequest;
import com.margins.memorycard.dto.CreateMemoryCardRequest;
import com.margins.memorycard.dto.MemoryCardDto;
import com.margins.memorycard.dto.MemoryCardGroupDto;
import com.margins.memorycard.dto.MemoryCardGroupListResponse;
import com.margins.memorycard.dto.MemoryCardInputDto;
import com.margins.memorycard.dto.MemoryCardListResponse;
import com.margins.memorycard.dto.UpdateMemoryCardGroupRequest;
import com.margins.memorycard.dto.UpdateMemoryCardRequest;
import com.margins.memorycard.mapper.MemoryCardMapper;
import com.margins.memorycard.model.MemoryCardGroupRecord;
import com.margins.memorycard.model.MemoryCardRecord;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MemoryCardBusiness {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final int MAX_CARDS = 500;

    private final MemoryCardMapper memoryCardMapper;
    private final BookMapper bookMapper;

    public MemoryCardGroupListResponse groups() {
        return groups(null);
    }

    public MemoryCardGroupListResponse groups(Long bookId) {
        Long userId = currentUserId();
        if (bookId != null) {
            requireOwnedBook(bookId, userId);
        }
        List<MemoryCardGroupDto> groups = memoryCardMapper.findGroups(userId, bookId).stream()
            .map((record) -> toGroupDto(record, null))
            .toList();
        return MemoryCardGroupListResponse.builder().groups(groups).build();
    }

    public MemoryCardGroupDto group(Long groupId) {
        MemoryCardGroupRecord group = requireGroup(groupId);
        return toGroupDto(group, cards(groupId).getCards());
    }

    @Transactional
    public MemoryCardGroupDto createGroup(CreateMemoryCardGroupRequest request) {
        Long userId = currentUserId();
        if (request.getBookId() != null) {
            requireOwnedBook(request.getBookId(), userId);
        }
        MemoryCardGroupRecord record = MemoryCardGroupRecord.builder()
            .userId(userId)
            .bookId(request.getBookId())
            .title(cleanRequired(request.getTitle(), "group.title", 255))
            .description(cleanOptional(request.getDescription(), 1000))
            .sourceLabel(cleanOptional(request.getSourceLabel(), 255))
            .testData(true)
            .build();
        if (memoryCardMapper.insertGroup(record) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Memory card group could not be saved");
        }
        return group(record.getId());
    }

    @Transactional
    public MemoryCardGroupDto updateGroup(Long groupId, UpdateMemoryCardGroupRequest request) {
        requireGroup(groupId);
        MemoryCardGroupRecord update = MemoryCardGroupRecord.builder()
            .id(groupId)
            .userId(currentUserId())
            .title(cleanRequired(request.getTitle(), "group.title", 255))
            .description(cleanOptional(request.getDescription(), 1000))
            .sourceLabel(cleanOptional(request.getSourceLabel(), 255))
            .build();
        if (memoryCardMapper.updateGroup(update) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Memory card group could not be updated");
        }
        return group(groupId);
    }

    @Transactional
    public MemoryCardGroupListResponse deleteGroup(Long groupId) {
        requireGroup(groupId);
        if (memoryCardMapper.softDeleteGroup(groupId, currentUserId()) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Memory card group could not be deleted");
        }
        return groups();
    }

    public MemoryCardListResponse cards(Long groupId) {
        requireGroup(groupId);
        return MemoryCardListResponse.builder()
            .groupId(groupId)
            .cards(memoryCardMapper.findCards(groupId).stream().map(this::toCardDto).toList())
            .build();
    }

    @Transactional
    public MemoryCardListResponse createCard(Long groupId, CreateMemoryCardRequest request) {
        requireGroup(groupId);
        MemoryCardRecord record = recordFromInput(groupId, request, memoryCardMapper.maxPosition(groupId) + 1, "");
        insertCard(record);
        memoryCardMapper.touchGroup(groupId);
        return cards(groupId);
    }

    @Transactional
    public MemoryCardListResponse updateCard(Long cardId, UpdateMemoryCardRequest request) {
        MemoryCardRecord existing = requireOwnedCard(cardId);
        MemoryCardRecord update = recordFromInput(existing.getGroupId(), request, existing.getPosition(), "");
        update.setId(cardId);
        if (memoryCardMapper.updateCard(update) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Memory card could not be updated");
        }
        memoryCardMapper.touchGroup(existing.getGroupId());
        return cards(existing.getGroupId());
    }

    @Transactional
    public MemoryCardListResponse updateCardMemorized(Long cardId, boolean memorized) {
        MemoryCardRecord existing = requireOwnedCard(cardId);
        MemoryCardRecord update = MemoryCardRecord.builder()
            .id(cardId)
            .groupId(existing.getGroupId())
            .memorized(memorized)
            .build();
        if (memoryCardMapper.updateCardMemorized(update) <= 0) {
            throw new ApiException(
                ApiErrorCode.COMMON_INTERNAL_ERROR,
                "Memory card memorized state could not be updated"
            );
        }
        memoryCardMapper.touchGroup(existing.getGroupId());
        return cards(existing.getGroupId());
    }

    @Transactional
    public MemoryCardListResponse deleteCard(Long cardId) {
        MemoryCardRecord existing = requireOwnedCard(cardId);
        if (memoryCardMapper.softDeleteCard(cardId, existing.getGroupId()) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Memory card could not be deleted");
        }
        memoryCardMapper.touchGroup(existing.getGroupId());
        return cards(existing.getGroupId());
    }

    @Transactional
    public MemoryCardGroupDto bulkCreateGroup(BulkMemoryCardGroupRequest request) {
        String policy = duplicatePolicy(request.getDuplicatePolicy());
        List<MemoryCardRecord> upload = prepareBulkCards(request, policy);
        MemoryCardGroupDto created = createGroup(request.getGroup());
        applyBulkCards(created.getGroupId(), upload, policy);
        return group(created.getGroupId());
    }

    @Transactional
    public MemoryCardListResponse bulkCards(Long groupId, BulkMemoryCardRequest request) {
        requireGroup(groupId);
        String policy = duplicatePolicy(request.getDuplicatePolicy());
        List<MemoryCardRecord> upload = prepareBulkCards(request, policy);
        applyBulkCards(groupId, upload, policy);
        return cards(groupId);
    }

    private void applyBulkCards(Long groupId, List<MemoryCardRecord> upload, String policy) {
        Map<String, MemoryCardRecord> existingByFront = new LinkedHashMap<>();
        for (MemoryCardRecord card : memoryCardMapper.findCards(groupId)) {
            existingByFront.putIfAbsent(frontKey(card.getFrontText()), card);
        }

        int nextPosition = memoryCardMapper.maxPosition(groupId) + 1;
        for (MemoryCardRecord card : upload) {
            MemoryCardRecord existing = existingByFront.get(frontKey(card.getFrontText()));
            if (existing != null && "remove".equals(policy)) {
                continue;
            }
            card.setGroupId(groupId);
            if (existing != null && "replace".equals(policy)) {
                card.setId(existing.getId());
                card.setPosition(existing.getPosition());
                memoryCardMapper.updateCard(card);
                continue;
            }
            card.setPosition(nextPosition++);
            insertCard(card);
        }
        memoryCardMapper.touchGroup(groupId);
    }

    private void insertCard(MemoryCardRecord record) {
        if (memoryCardMapper.insertCard(record) <= 0) {
            throw new ApiException(ApiErrorCode.COMMON_INTERNAL_ERROR, "Memory card could not be saved");
        }
    }

    private MemoryCardRecord recordFromInput(Long groupId, MemoryCardInputDto input, int position, String fieldPrefix) {
        return MemoryCardRecord.builder()
            .groupId(groupId)
            .frontText(cleanRequired(input.getFrontText(), fieldPrefix + "frontText", 200))
            .backText(cleanRequired(input.getBackText(), fieldPrefix + "backText", 500))
            .exampleText(cleanOptionalWithName(input.getExampleText(), fieldPrefix.isEmpty() ? "field" : fieldPrefix + "exampleText", 1000))
            .memo(cleanOptionalWithName(input.getMemo(), fieldPrefix.isEmpty() ? "field" : fieldPrefix + "memo", 1000))
            .memorized(false)
            .position(position)
            .testData(true)
            .build();
    }

    private List<MemoryCardRecord> prepareBulkCards(BulkMemoryCardRequest request, String policy) {
        if (request.getCards() == null || request.getCards().isEmpty()) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "cards is required");
        }
        if (request.getCards().size() > MAX_CARDS) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "cards must contain 1 to 500 items");
        }
        List<MemoryCardRecord> cards = new ArrayList<>();
        for (int index = 0; index < request.getCards().size(); index++) {
            cards.add(recordFromInput(null, request.getCards().get(index), 0, "cards[" + index + "]."));
        }
        if ("ignore".equals(policy)) {
            return cards;
        }

        Map<String, MemoryCardRecord> byFront = new LinkedHashMap<>();
        for (MemoryCardRecord card : cards) {
            String key = frontKey(card.getFrontText());
            if ("remove".equals(policy) && byFront.containsKey(key)) {
                continue;
            }
            byFront.put(key, card);
        }
        return new ArrayList<>(byFront.values());
    }

    private MemoryCardGroupRecord requireGroup(Long groupId) {
        MemoryCardGroupRecord group = memoryCardMapper.findGroup(groupId, currentUserId());
        if (group == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Memory card group not found");
        }
        return group;
    }

    private void requireOwnedBook(Long bookId, Long userId) {
        if (bookMapper.findByIdForUser(bookId, userId) == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Book was not found");
        }
    }

    private MemoryCardRecord requireOwnedCard(Long cardId) {
        MemoryCardRecord card = memoryCardMapper.findCard(cardId);
        if (card == null || memoryCardMapper.findGroup(card.getGroupId(), currentUserId()) == null) {
            throw new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "Memory card not found");
        }
        return card;
    }

    private Long currentUserId() {
        return AuthContext.requireUserId();
    }

    private String duplicatePolicy(String value) {
        String normalized = value == null || value.isBlank()
            ? "replace"
            : value.trim().toLowerCase(Locale.ROOT);
        if (!normalized.equals("replace") && !normalized.equals("remove") && !normalized.equals("ignore")) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, "duplicatePolicy must be replace, remove, or ignore");
        }
        return normalized;
    }

    private String frontKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String cleanRequired(String value, String field, int max) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.isBlank()) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, field + " is required");
        }
        if (cleaned.length() > max) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, field + " must be " + max + " characters or less");
        }
        return cleaned;
    }

    private String cleanOptional(String value, int max) {
        return cleanOptionalWithName(value, "field", max);
    }

    private String cleanOptionalWithName(String value, String field, int max) {
        if (value == null) {
            return null;
        }
        String cleaned = value.trim();
        if (cleaned.length() > max) {
            throw new ApiException(ApiErrorCode.COMMON_BAD_REQUEST, field + " must be " + max + " characters or less");
        }
        return cleaned.isBlank() ? null : cleaned;
    }

    private MemoryCardGroupDto toGroupDto(MemoryCardGroupRecord record, List<MemoryCardDto> cards) {
        return MemoryCardGroupDto.builder()
            .groupId(record.getId())
            .bookId(record.getBookId())
            .title(record.getTitle())
            .description(record.getDescription())
            .sourceLabel(record.getSourceLabel())
            .cardCount(record.getCardCount() == null ? (cards == null ? 0 : cards.size()) : record.getCardCount())
            .updatedAt(record.getUpdatedAt() == null ? null : DATE_TIME.format(record.getUpdatedAt()))
            .cards(cards)
            .build();
    }

    private MemoryCardDto toCardDto(MemoryCardRecord record) {
        return MemoryCardDto.builder()
            .cardId(record.getId())
            .groupId(record.getGroupId())
            .frontText(record.getFrontText())
            .backText(record.getBackText())
            .exampleText(record.getExampleText())
            .memo(record.getMemo())
            .memorized(Boolean.TRUE.equals(record.getMemorized()))
            .position(record.getPosition())
            .updatedAt(record.getUpdatedAt() == null ? null : DATE_TIME.format(record.getUpdatedAt()))
            .build();
    }
}
