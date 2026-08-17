package com.margins.common.filter;

import com.margins.common.support.RequestCorrelationContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Creates a server-owned correlation id for every HTTP request. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationFilter extends OncePerRequestFilter {
    public static final String REQUEST_ID_ATTRIBUTE = "margins.requestId";
    public static final String RESPONSE_HEADER = "X-Request-ID";

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String requestId = RequestCorrelationContext.bindNew();
        request.setAttribute(REQUEST_ID_ATTRIBUTE, requestId);
        response.setHeader(RESPONSE_HEADER, requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            RequestCorrelationContext.clear();
        }
    }
}
