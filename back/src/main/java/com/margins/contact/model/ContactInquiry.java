package com.margins.contact.model;

import java.time.Instant;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ContactInquiry {
    private Long id;
    private String email;
    private String category;
    private String subject;
    private String message;
    private String status;
    private Instant createdAt;
    private Instant deleteAfter;
    private boolean testData;
}
