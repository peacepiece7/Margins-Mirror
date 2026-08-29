package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.margins.account.mapper.AccountMapper;
import com.margins.ai.GenerationLocale;
import com.margins.ai.GenerationLocaleResolver;
import com.margins.auth.model.UserRecord;
import com.margins.common.error.ApiException;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class GenerationLocaleResolverTest {
    private final AccountMapper mapper = mock(AccountMapper.class);
    private final GenerationLocaleResolver resolver = new GenerationLocaleResolver(mapper);

    @Test
    void exactKoMapsToKoAndEveryLegacyValueMapsToEn() {
        when(mapper.findUserById(1L)).thenReturn(Optional.of(user("ko")));
        when(mapper.findUserById(2L)).thenReturn(Optional.of(user("KO")));
        when(mapper.findUserById(3L)).thenReturn(Optional.of(user(null)));

        assertThat(resolver.resolve(1L)).isEqualTo(GenerationLocale.KO);
        assertThat(resolver.resolve(2L)).isEqualTo(GenerationLocale.EN);
        assertThat(resolver.resolve(3L)).isEqualTo(GenerationLocale.EN);
    }

    @Test
    void missingUserDoesNotBecomeAnEnglishGeneration() {
        when(mapper.findUserById(9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> resolver.resolve(9L)).isInstanceOf(ApiException.class);
    }

    private UserRecord user(String locale) {
        return UserRecord.builder().id(1L).preferredLocale(locale).build();
    }
}
