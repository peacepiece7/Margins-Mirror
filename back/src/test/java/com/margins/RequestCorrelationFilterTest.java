package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.common.dto.ApiError;
import com.margins.common.filter.RequestCorrelationFilter;
import com.margins.common.support.RequestCorrelationContext;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestCorrelationFilterTest {
    @Test
    void bindsOneServerOwnedIdToResponseAndApiError() throws Exception {
        RequestCorrelationFilter filter = new RequestCorrelationFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/reflection-interviews/1/guides");
        MockHttpServletResponse response = new MockHttpServletResponse();
        String[] errorRequestId = new String[1];

        try {
            filter.doFilter(request, response, (servletRequest, servletResponse) -> {
                errorRequestId[0] = ApiError.of(com.margins.common.error.ApiErrorCode.COMMON_UPSTREAM_ERROR)
                    .getRequestId();
            });

            assertThat(response.getHeader(RequestCorrelationFilter.RESPONSE_HEADER)).isEqualTo(errorRequestId[0]);
            assertThat(request.getAttribute(RequestCorrelationFilter.REQUEST_ID_ATTRIBUTE))
                .isEqualTo(errorRequestId[0]);
        } finally {
            RequestCorrelationContext.clear();
        }
    }
}
