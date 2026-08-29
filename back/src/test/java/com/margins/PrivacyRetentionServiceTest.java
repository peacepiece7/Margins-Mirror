package com.margins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.margins.privacy.mapper.PrivacyRetentionMapper;
import com.margins.privacy.service.PrivacyRetentionService;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.transaction.support.TransactionTemplate;

class PrivacyRetentionServiceTest {
    @Test
    void includesContactInquiryDeadlineInExistingMaintenance() {
        PrivacyRetentionMapper mapper = mock(PrivacyRetentionMapper.class);
        when(mapper.deleteContactInquiriesDue(any())).thenReturn(2);
        PrivacyRetentionService service = new PrivacyRetentionService(
            mapper, mock(Environment.class), mock(TransactionTemplate.class));
        Instant now = Instant.parse("2026-08-24T00:00:00Z");

        var result = service.runMaintenanceAt(now);

        assertThat(result.contactInquiries()).isEqualTo(2);
        verify(mapper).deleteContactInquiriesDue(now);
    }
}
