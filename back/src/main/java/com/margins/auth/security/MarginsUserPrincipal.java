package com.margins.auth.security;

import java.util.Collection;
import java.util.List;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

@Getter
public class MarginsUserPrincipal implements UserDetails {

    private final Long userId;
    private final String username;
    private final String displayName;
    private final String authProvider;
    private final boolean consentRequired;

    public MarginsUserPrincipal(Long userId, String username, String displayName, String authProvider) {
        this(userId, username, displayName, authProvider, false);
    }

    public MarginsUserPrincipal(
        Long userId,
        String username,
        String displayName,
        String authProvider,
        boolean consentRequired
    ) {
        this.userId = userId;
        this.username = username;
        this.displayName = displayName;
        this.authProvider = authProvider;
        this.consentRequired = consentRequired;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(consentRequired ? "ROLE_CONSENT_PENDING" : "ROLE_USER"));
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
