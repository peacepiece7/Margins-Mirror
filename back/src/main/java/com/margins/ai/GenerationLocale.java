package com.margins.ai;

public enum GenerationLocale {
    KO("ko"),
    EN("en");

    private final String value;

    GenerationLocale(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static GenerationLocale fromPersisted(String value) {
        return "ko".equals(value) ? KO : EN;
    }

    public String languageInstruction() {
        return this == KO
            ? "Respond in Korean."
            : "Respond in English.";
    }
}
