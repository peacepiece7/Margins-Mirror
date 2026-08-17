package com.margins.memorycard.controller;

import com.margins.common.dto.ApiResponse;
import com.margins.memorycard.dto.BulkMemoryCardGroupRequest;
import com.margins.memorycard.dto.BulkMemoryCardRequest;
import com.margins.memorycard.dto.CreateMemoryCardGroupRequest;
import com.margins.memorycard.dto.CreateMemoryCardRequest;
import com.margins.memorycard.dto.MemoryCardGroupDto;
import com.margins.memorycard.dto.MemoryCardGroupListResponse;
import com.margins.memorycard.dto.MemoryCardListResponse;
import com.margins.memorycard.dto.UpdateMemoryCardGroupRequest;
import com.margins.memorycard.dto.UpdateMemoryCardMemorizedRequest;
import com.margins.memorycard.dto.UpdateMemoryCardRequest;
import com.margins.memorycard.service.MemoryCardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class MemoryCardController {

    private final MemoryCardService memoryCardService;

    @GetMapping("/api/memory-card-groups")
    public ApiResponse<MemoryCardGroupListResponse> groups() {
        return ApiResponse.ok(memoryCardService.groups());
    }

    @PostMapping("/api/memory-card-groups")
    public ApiResponse<MemoryCardGroupDto> createGroup(@Valid @RequestBody CreateMemoryCardGroupRequest request) {
        return ApiResponse.ok(memoryCardService.createGroup(request));
    }

    @PostMapping("/api/memory-card-groups/bulk")
    public ApiResponse<MemoryCardGroupDto> bulkCreateGroup(@Valid @RequestBody BulkMemoryCardGroupRequest request) {
        return ApiResponse.ok(memoryCardService.bulkCreateGroup(request));
    }

    @GetMapping("/api/memory-card-groups/{groupId}")
    public ApiResponse<MemoryCardGroupDto> group(@PathVariable Long groupId) {
        return ApiResponse.ok(memoryCardService.group(groupId));
    }

    @PatchMapping("/api/memory-card-groups/{groupId}")
    public ApiResponse<MemoryCardGroupDto> updateGroup(
        @PathVariable Long groupId,
        @Valid @RequestBody UpdateMemoryCardGroupRequest request
    ) {
        return ApiResponse.ok(memoryCardService.updateGroup(groupId, request));
    }

    @DeleteMapping("/api/memory-card-groups/{groupId}")
    public ApiResponse<MemoryCardGroupListResponse> deleteGroup(@PathVariable Long groupId) {
        return ApiResponse.ok(memoryCardService.deleteGroup(groupId));
    }

    @GetMapping("/api/memory-card-groups/{groupId}/cards")
    public ApiResponse<MemoryCardListResponse> cards(@PathVariable Long groupId) {
        return ApiResponse.ok(memoryCardService.cards(groupId));
    }

    @PostMapping("/api/memory-card-groups/{groupId}/cards")
    public ApiResponse<MemoryCardListResponse> createCard(
        @PathVariable Long groupId,
        @Valid @RequestBody CreateMemoryCardRequest request
    ) {
        return ApiResponse.ok(memoryCardService.createCard(groupId, request));
    }

    @PostMapping("/api/memory-card-groups/{groupId}/cards/bulk")
    public ApiResponse<MemoryCardListResponse> bulkCards(
        @PathVariable Long groupId,
        @Valid @RequestBody BulkMemoryCardRequest request
    ) {
        return ApiResponse.ok(memoryCardService.bulkCards(groupId, request));
    }

    @PatchMapping("/api/memory-cards/{cardId}")
    public ApiResponse<MemoryCardListResponse> updateCard(
        @PathVariable Long cardId,
        @Valid @RequestBody UpdateMemoryCardRequest request
    ) {
        return ApiResponse.ok(memoryCardService.updateCard(cardId, request));
    }

    @PatchMapping("/api/memory-cards/{cardId}/memorized")
    public ApiResponse<MemoryCardListResponse> updateCardMemorized(
        @PathVariable Long cardId,
        @Valid @RequestBody UpdateMemoryCardMemorizedRequest request
    ) {
        return ApiResponse.ok(memoryCardService.updateCardMemorized(cardId, request.getMemorized()));
    }

    @DeleteMapping("/api/memory-cards/{cardId}")
    public ApiResponse<MemoryCardListResponse> deleteCard(@PathVariable Long cardId) {
        return ApiResponse.ok(memoryCardService.deleteCard(cardId));
    }
}
