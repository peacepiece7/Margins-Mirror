package com.margins.ai;

import java.util.Collection;
import org.springframework.stereotype.Component;

@Component
public class AiOutputLanguageValidator {

    public AiLanguageValidationOutcome validate(GenerationLocale locale, String text) {
        int hangul = 0;
        int latin = 0;
        if (text != null) {
            for (int index = 0; index < text.length();) {
                int codePoint = text.codePointAt(index);
                Character.UnicodeScript script = Character.UnicodeScript.of(codePoint);
                if (script == Character.UnicodeScript.HANGUL) {
                    hangul++;
                } else if (script == Character.UnicodeScript.LATIN) {
                    latin++;
                }
                index += Character.charCount(codePoint);
            }
        }
        if (hangul > 0 && latin > 0) {
            return AiLanguageValidationOutcome.UNKNOWN;
        }
        if (locale == GenerationLocale.KO) {
            if (hangul >= 8) return AiLanguageValidationOutcome.MATCH;
            if (hangul == 0 && latin >= 24) return AiLanguageValidationOutcome.KNOWN_MISMATCH;
        } else {
            if (latin >= 16) return AiLanguageValidationOutcome.MATCH;
            if (latin == 0 && hangul >= 12) return AiLanguageValidationOutcome.KNOWN_MISMATCH;
        }
        return AiLanguageValidationOutcome.UNKNOWN;
    }

    public AiLanguageValidationOutcome validateUnits(
        GenerationLocale locale,
        Collection<String> displayUnits
    ) {
        boolean matched = false;
        if (displayUnits != null) {
            for (String unit : displayUnits) {
                AiLanguageValidationOutcome outcome = validate(locale, unit);
                if (outcome == AiLanguageValidationOutcome.KNOWN_MISMATCH) {
                    return outcome;
                }
                matched |= outcome == AiLanguageValidationOutcome.MATCH;
            }
        }
        return matched ? AiLanguageValidationOutcome.MATCH : AiLanguageValidationOutcome.UNKNOWN;
    }
}
