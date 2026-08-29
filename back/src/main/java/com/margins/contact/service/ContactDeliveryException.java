package com.margins.contact.service;

import lombok.Getter;

/** 문의 알림 provider 실패를 bounded 내부 코드로 운반하는 예외다. */
@Getter
public class ContactDeliveryException extends RuntimeException {
    private final String failureCode;

    public ContactDeliveryException(String failureCode) {
        super("contact email delivery failed");
        this.failureCode = failureCode;
    }

    public ContactDeliveryException(String failureCode, Throwable cause) {
        super("contact email delivery failed", cause);
        this.failureCode = failureCode;
    }
}
