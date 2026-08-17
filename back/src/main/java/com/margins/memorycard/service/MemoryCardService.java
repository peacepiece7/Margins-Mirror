package com.margins.memorycard.service;

import com.margins.memorycard.business.MemoryCardBusiness;
import com.margins.memorycard.dto.BulkMemoryCardGroupRequest;
import com.margins.memorycard.dto.BulkMemoryCardRequest;
import com.margins.memorycard.dto.CreateMemoryCardGroupRequest;
import com.margins.memorycard.dto.CreateMemoryCardRequest;
import com.margins.memorycard.dto.MemoryCardGroupDto;
import com.margins.memorycard.dto.MemoryCardGroupListResponse;
import com.margins.memorycard.dto.MemoryCardListResponse;
import com.margins.memorycard.dto.UpdateMemoryCardGroupRequest;
import com.margins.memorycard.dto.UpdateMemoryCardRequest;
import com.margins.membership.service.MembershipService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MemoryCardService {

    private final MemoryCardBusiness memoryCardBusiness;
    private final MembershipService membershipService;

    public MemoryCardGroupListResponse groups() {
        membershipService.requirePremium();
        return memoryCardBusiness.groups();
    }

    public MemoryCardGroupDto group(Long groupId) {
        membershipService.requirePremium();
        return memoryCardBusiness.group(groupId);
    }

    public MemoryCardGroupDto createGroup(CreateMemoryCardGroupRequest request) {
        membershipService.requirePremium();
        return memoryCardBusiness.createGroup(request);
    }

    public MemoryCardGroupDto bulkCreateGroup(BulkMemoryCardGroupRequest request) {
        membershipService.requirePremium();
        return memoryCardBusiness.bulkCreateGroup(request);
    }

    public MemoryCardGroupDto updateGroup(Long groupId, UpdateMemoryCardGroupRequest request) {
        membershipService.requirePremium();
        return memoryCardBusiness.updateGroup(groupId, request);
    }

    public MemoryCardGroupListResponse deleteGroup(Long groupId) {
        membershipService.requirePremium();
        return memoryCardBusiness.deleteGroup(groupId);
    }

    public MemoryCardListResponse cards(Long groupId) {
        membershipService.requirePremium();
        return memoryCardBusiness.cards(groupId);
    }

    public MemoryCardListResponse createCard(Long groupId, CreateMemoryCardRequest request) {
        membershipService.requirePremium();
        return memoryCardBusiness.createCard(groupId, request);
    }

    public MemoryCardListResponse bulkCards(Long groupId, BulkMemoryCardRequest request) {
        membershipService.requirePremium();
        return memoryCardBusiness.bulkCards(groupId, request);
    }

    public MemoryCardListResponse updateCard(Long cardId, UpdateMemoryCardRequest request) {
        membershipService.requirePremium();
        return memoryCardBusiness.updateCard(cardId, request);
    }

    public MemoryCardListResponse updateCardMemorized(Long cardId, boolean memorized) {
        membershipService.requirePremium();
        return memoryCardBusiness.updateCardMemorized(cardId, memorized);
    }

    public MemoryCardListResponse deleteCard(Long cardId) {
        membershipService.requirePremium();
        return memoryCardBusiness.deleteCard(cardId);
    }
}
