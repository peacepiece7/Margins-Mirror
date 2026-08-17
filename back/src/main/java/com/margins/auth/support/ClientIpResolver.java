package com.margins.auth.support;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import org.springframework.stereotype.Component;

@Component
public class ClientIpResolver {
    public String resolve(HttpServletRequest request) {
        String remote = normalize(request.getRemoteAddr());
        // 127.0.0.1(localhost) 환경이면 X-Real-IP 헤더 사용
        if (isLoopback(remote)) {
            String realIp = normalize(request.getHeader("X-Real-IP"));
            if (realIp != null) return realIp;
        }
        return remote == null ? "unknown" : remote;
    }

    private boolean isLoopback(String value) {
        if (value == null) return false;
        try {
            return InetAddress.getByName(value).isLoopbackAddress();
        } catch (Exception exception) {
            return false;
        }
    }

    private String normalize(String value) {
        if (value == null) return null;
        String candidate = value.trim();
        if (candidate.isEmpty() || candidate.length() > 45
            || candidate.contains("%") || !candidate.matches("[0-9A-Fa-f:.]+")) {
            return null;
        }
        try {
            return InetAddress.getByName(candidate).getHostAddress();
        } catch (Exception exception) {
            return null;
        }
    }
}
