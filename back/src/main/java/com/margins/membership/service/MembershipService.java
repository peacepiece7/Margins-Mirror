package com.margins.membership.service;

import com.margins.auth.support.AuthContext;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import com.margins.membership.mapper.MembershipMapper;
import com.margins.membership.model.MembershipTier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MembershipService {

    private final MembershipMapper membershipMapper;

    public MembershipTier tierFor(Long userId) {
        return membershipMapper.findActiveTier(userId)
            .map(MembershipTier::valueOf)
            .orElse(MembershipTier.FREE);
    }

    public void requirePremium() {
        if (tierFor(AuthContext.requireUserId()) != MembershipTier.PREMIUM) {
            throw new ApiException(ApiErrorCode.MEMBERSHIP_PREMIUM_REQUIRED);
        }
    }
}
