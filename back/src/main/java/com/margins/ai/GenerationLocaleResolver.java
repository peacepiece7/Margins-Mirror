package com.margins.ai;

import com.margins.account.mapper.AccountMapper;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class GenerationLocaleResolver {
    private final AccountMapper accountMapper;

    public GenerationLocale resolve(Long userId) {
        return accountMapper.findUserById(userId)
            .map(user -> GenerationLocale.fromPersisted(user.getPreferredLocale()))
            .orElseThrow(() -> new ApiException(ApiErrorCode.COMMON_NOT_FOUND, "User not found"));
    }
}
