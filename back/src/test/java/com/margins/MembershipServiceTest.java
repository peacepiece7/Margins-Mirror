package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.margins.membership.mapper.MembershipMapper;
import com.margins.membership.model.MembershipTier;
import com.margins.membership.service.MembershipService;
import com.margins.testsupport.TestSecurityContextSupport;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(TestSecurityContextSupport.Extension.class)
class MembershipServiceTest {

    @Test
    void missingMembershipDefaultsToFreeAndRejectsMemoryCardAccess() {
        MembershipMapper mapper = mock(MembershipMapper.class);
        when(mapper.findActiveTier(1L)).thenReturn(Optional.empty());
        MembershipService service = new MembershipService(mapper);

        assertThat(service.tierFor(1L)).isEqualTo(MembershipTier.FREE);
        assertThatThrownBy(service::requirePremium)
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void premiumMembershipAllowsMemoryCardAccess() {
        MembershipMapper mapper = mock(MembershipMapper.class);
        when(mapper.findActiveTier(1L)).thenReturn(Optional.of("PREMIUM"));
        MembershipService service = new MembershipService(mapper);

        assertThat(service.tierFor(1L)).isEqualTo(MembershipTier.PREMIUM);
        assertThatCode(service::requirePremium).doesNotThrowAnyException();
    }
}
