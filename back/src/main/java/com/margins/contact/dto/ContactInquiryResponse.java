package com.margins.contact.dto;

import java.time.Instant;

public record ContactInquiryResponse(Long inquiryId, String status, Instant createdAt) { }
