package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.common.controller.ApiExceptionHandler;
import com.margins.common.error.ApiErrorCode;
import com.margins.common.error.ApiException;
import org.junit.jupiter.api.Test;

class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void internalReasonIsNotSerializedAsPublicMessage() {
        var response = handler.handleApi(new ApiException(
            ApiErrorCode.COMMON_NOT_FOUND,
            "private lookup diagnostic"
        ));

        assertThat(response.getBody().getError().getMessage()).isNull();
    }

    @Test
    void explicitlyBoundedPublicMessageIsSerialized() {
        var response = handler.handleApi(new ApiException(
            ApiErrorCode.COMMON_NOT_FOUND,
            "private lookup diagnostic",
            "Reflection을 아직 작성하지 않았어."
        ));

        assertThat(response.getBody().getError().getMessage())
            .isEqualTo("Reflection을 아직 작성하지 않았어.");
    }
}
