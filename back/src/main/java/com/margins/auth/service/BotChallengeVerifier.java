package com.margins.auth.service;

public interface BotChallengeVerifier {
    void verify(String token, String clientIp);
}
