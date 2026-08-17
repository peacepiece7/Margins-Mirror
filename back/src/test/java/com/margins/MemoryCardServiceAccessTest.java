package com.margins;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.margins.memorycard.business.MemoryCardBusiness;
import com.margins.memorycard.service.MemoryCardService;
import com.margins.membership.service.MembershipService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class MemoryCardServiceAccessTest {

    @Test
    void everyMemoryCardOperationRequiresPremiumBeforeBusinessLogic() {
        MemoryCardBusiness business = mock(MemoryCardBusiness.class);
        MembershipService membership = mock(MembershipService.class);
        MemoryCardService service = new MemoryCardService(business, membership);
        ResponseStatusException forbidden =
            new ResponseStatusException(HttpStatus.FORBIDDEN, "Premium membership required");
        doThrow(forbidden).when(membership).requirePremium();

        List<Executable> operations = List.of(
            service::groups,
            () -> service.group(1L),
            () -> service.createGroup(null),
            () -> service.bulkCreateGroup(null),
            () -> service.updateGroup(1L, null),
            () -> service.deleteGroup(1L),
            () -> service.cards(1L),
            () -> service.createCard(1L, null),
            () -> service.bulkCards(1L, null),
            () -> service.updateCard(1L, null),
            () -> service.updateCardMemorized(1L, true),
            () -> service.deleteCard(1L)
        );

        operations.forEach(operation ->
            assertThatThrownBy(operation::execute).isSameAs(forbidden));

        verify(membership, times(operations.size())).requirePremium();
        verifyNoInteractions(business);
    }
}
