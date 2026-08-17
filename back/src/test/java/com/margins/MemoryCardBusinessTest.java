package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.margins.memorycard.business.MemoryCardBusiness;
import com.margins.memorycard.dto.BulkMemoryCardRequest;
import com.margins.memorycard.dto.BulkMemoryCardGroupRequest;
import com.margins.memorycard.dto.CreateMemoryCardGroupRequest;
import com.margins.memorycard.dto.MemoryCardGroupDto;
import com.margins.memorycard.dto.MemoryCardInputDto;
import com.margins.memorycard.mapper.MemoryCardMapper;
import com.margins.memorycard.model.MemoryCardGroupRecord;
import com.margins.memorycard.model.MemoryCardRecord;
import com.margins.testsupport.TestSecurityContextSupport;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class MemoryCardBusinessTest {

    @Test
    void bulkUploadDefaultsToReplacingDuplicateCards() {
        FakeMemoryCardMapper mapper = new FakeMemoryCardMapper();
        mapper.seedCardOnInsertGroup = false;
        MemoryCardBusiness business = new MemoryCardBusiness(mapper);
        Long groupId = createGroup(business);

        BulkMemoryCardRequest request = new BulkMemoryCardRequest();
        request.setCards(List.of(card("WAND", "새 지팡이"), card("cloak", "망토")));

        business.bulkCards(groupId, request);

        assertThat(mapper.cards).extracting(MemoryCardRecord::getFrontText)
            .containsExactly("WAND", "cloak");
        assertThat(mapper.cards.get(0).getBackText()).isEqualTo("새 지팡이");
    }

    @Test
    void bulkUploadCanRemoveDuplicateUploadedCards() {
        FakeMemoryCardMapper mapper = new FakeMemoryCardMapper();
        MemoryCardBusiness business = new MemoryCardBusiness(mapper);
        Long groupId = createGroup(business);

        BulkMemoryCardRequest request = new BulkMemoryCardRequest();
        request.setDuplicatePolicy("remove");
        request.setCards(List.of(card("wand", "수정되지 않음"), card("cloak", "망토")));

        business.bulkCards(groupId, request);

        assertThat(mapper.cards).extracting(MemoryCardRecord::getFrontText)
            .containsExactly("wand", "cloak");
        assertThat(mapper.cards.get(0).getBackText()).isEqualTo("지팡이");
    }

    @Test
    void bulkUploadCanIgnoreDuplicatesAndInsertNewRows() {
        FakeMemoryCardMapper mapper = new FakeMemoryCardMapper();
        MemoryCardBusiness business = new MemoryCardBusiness(mapper);
        Long groupId = createGroup(business);

        BulkMemoryCardRequest request = new BulkMemoryCardRequest();
        request.setDuplicatePolicy("ignore");
        request.setCards(List.of(card("wand", "중복 지팡이")));

        business.bulkCards(groupId, request);

        assertThat(mapper.cards).extracting(MemoryCardRecord::getFrontText)
            .containsExactly("wand", "wand");
        assertThat(mapper.cards.get(1).getBackText()).isEqualTo("중복 지팡이");
    }

    @Test
    void bulkCreateGroupAppliesDuplicatePolicyInsideUploadedFile() {
        FakeMemoryCardMapper mapper = new FakeMemoryCardMapper();
        MemoryCardBusiness business = new MemoryCardBusiness(mapper);
        BulkMemoryCardGroupRequest request = new BulkMemoryCardGroupRequest();
        CreateMemoryCardGroupRequest group = new CreateMemoryCardGroupRequest();
        group.setTitle("Bulk group");
        request.setGroup(group);
        request.setDuplicatePolicy("replace");
        request.setCards(List.of(card("wand", "첫 뜻"), card("WAND", "마지막 뜻")));

        MemoryCardGroupDto response = business.bulkCreateGroup(request);

        assertThat(response.getCards()).extracting("frontText").containsExactly("WAND");
        assertThat(response.getCards()).extracting("backText").containsExactly("마지막 뜻");
    }

    @Test
    void bulkUploadRejectsInvalidPolicyBeforeSaving() {
        FakeMemoryCardMapper mapper = new FakeMemoryCardMapper();
        MemoryCardBusiness business = new MemoryCardBusiness(mapper);
        Long groupId = createGroup(business);

        BulkMemoryCardRequest request = new BulkMemoryCardRequest();
        request.setDuplicatePolicy("replace,remove");
        request.setCards(List.of(card("cloak", "망토")));

        assertThatThrownBy(() -> business.bulkCards(groupId, request))
            .isInstanceOfSatisfying(ResponseStatusException.class, (exception) ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThat(mapper.cards).extracting(MemoryCardRecord::getFrontText).containsExactly("wand");
    }

    @Test
    void memorizedStateCanBeCheckedAndUncheckedWithoutChangingCardText() {
        FakeMemoryCardMapper mapper = new FakeMemoryCardMapper();
        MemoryCardBusiness business = new MemoryCardBusiness(mapper);
        Long groupId = createGroup(business);
        Long cardId = mapper.findCards(groupId).get(0).getId();

        var checked = business.updateCardMemorized(cardId, true);

        assertThat(checked.getCards().get(0).getMemorized()).isTrue();
        assertThat(checked.getCards().get(0).getFrontText()).isEqualTo("wand");
        assertThat(checked.getCards().get(0).getBackText()).isEqualTo("지팡이");

        var unchecked = business.updateCardMemorized(cardId, false);

        assertThat(unchecked.getCards().get(0).getMemorized()).isFalse();
    }

    private Long createGroup(MemoryCardBusiness business) {
        CreateMemoryCardGroupRequest request = new CreateMemoryCardGroupRequest();
        request.setTitle("해리포터 1~4 챕터 자주 사용하는 단어모음");
        MemoryCardGroupDto group = business.createGroup(request);
        return group.getGroupId();
    }

    private MemoryCardInputDto card(String frontText, String backText) {
        MemoryCardInputDto card = new MemoryCardInputDto();
        card.setFrontText(frontText);
        card.setBackText(backText);
        return card;
    }

    private static class FakeMemoryCardMapper implements MemoryCardMapper {
        private long nextGroupId = 10L;
        private long nextCardId = 100L;
        private boolean seedCardOnInsertGroup = true;
        private final List<MemoryCardGroupRecord> groups = new ArrayList<>();
        private final List<MemoryCardRecord> cards = new ArrayList<>();

        @Override
        public List<MemoryCardGroupRecord> findGroups(Long userId) {
            return groups.stream()
                .filter((group) -> group.getUserId().equals(userId))
                .map((group) -> {
                    group.setCardCount((int) cards.stream()
                        .filter((card) -> card.getGroupId().equals(group.getId()))
                        .count());
                    return group;
                })
                .toList();
        }

        @Override
        public MemoryCardGroupRecord findGroup(Long groupId, Long userId) {
            return groups.stream()
                .filter((group) -> group.getId().equals(groupId) && group.getUserId().equals(userId))
                .findFirst()
                .orElse(null);
        }

        @Override
        public int insertGroup(MemoryCardGroupRecord record) {
            record.setId(nextGroupId++);
            record.setUpdatedAt(LocalDateTime.now());
            groups.add(record);
            if (seedCardOnInsertGroup) {
                cards.add(MemoryCardRecord.builder()
                    .id(nextCardId++)
                    .groupId(record.getId())
                    .frontText("wand")
                    .backText("지팡이")
                    .memorized(false)
                    .position(1)
                    .testData(true)
                    .updatedAt(LocalDateTime.now())
                    .build());
            }
            return 1;
        }

        @Override
        public int updateGroup(MemoryCardGroupRecord record) {
            return 1;
        }

        @Override
        public int softDeleteGroup(Long groupId, Long userId) {
            return groups.removeIf((group) -> group.getId().equals(groupId) && group.getUserId().equals(userId)) ? 1 : 0;
        }

        @Override
        public List<MemoryCardRecord> findCards(Long groupId) {
            return cards.stream()
                .filter((card) -> card.getGroupId().equals(groupId))
                .sorted(Comparator.comparing(MemoryCardRecord::getPosition).thenComparing(MemoryCardRecord::getId))
                .toList();
        }

        @Override
        public MemoryCardRecord findCard(Long cardId) {
            return cards.stream()
                .filter((card) -> card.getId().equals(cardId))
                .findFirst()
                .orElse(null);
        }

        @Override
        public int maxPosition(Long groupId) {
            return findCards(groupId).stream()
                .map(MemoryCardRecord::getPosition)
                .max(Integer::compareTo)
                .orElse(0);
        }

        @Override
        public int insertCard(MemoryCardRecord record) {
            record.setId(nextCardId++);
            record.setUpdatedAt(LocalDateTime.now());
            cards.add(record);
            return 1;
        }

        @Override
        public int updateCard(MemoryCardRecord record) {
            MemoryCardRecord existing = findCard(record.getId());
            if (existing == null) {
                return 0;
            }
            existing.setFrontText(record.getFrontText());
            existing.setBackText(record.getBackText());
            existing.setExampleText(record.getExampleText());
            existing.setMemo(record.getMemo());
            existing.setUpdatedAt(LocalDateTime.now());
            return 1;
        }

        @Override
        public int updateCardMemorized(MemoryCardRecord record) {
            MemoryCardRecord existing = findCard(record.getId());
            if (existing == null || !existing.getGroupId().equals(record.getGroupId())) {
                return 0;
            }
            existing.setMemorized(record.getMemorized());
            existing.setUpdatedAt(LocalDateTime.now());
            return 1;
        }

        @Override
        public int softDeleteCard(Long cardId, Long groupId) {
            return cards.removeIf((card) -> card.getId().equals(cardId) && card.getGroupId().equals(groupId)) ? 1 : 0;
        }

        @Override
        public int touchGroup(Long groupId) {
            MemoryCardGroupRecord group = groups.stream()
                .filter((candidate) -> candidate.getId().equals(groupId))
                .findFirst()
                .orElse(null);
            if (group != null) {
                group.setUpdatedAt(LocalDateTime.now());
            }
            return group == null ? 0 : 1;
        }
    }
}
