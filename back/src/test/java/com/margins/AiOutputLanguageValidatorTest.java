package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.margins.ai.AiLanguageValidationOutcome;
import com.margins.ai.AiOutputLanguageValidator;
import com.margins.ai.GenerationLocale;
import java.util.List;
import org.junit.jupiter.api.Test;

class AiOutputLanguageValidatorTest {
    private final AiOutputLanguageValidator validator = new AiOutputLanguageValidator();

    @Test
    void followsExactThresholdsAndTreatsMixedScriptAsUnknownFirst() {
        assertThat(validator.validate(GenerationLocale.KO, "가나다라마바사아"))
            .isEqualTo(AiLanguageValidationOutcome.MATCH);
        assertThat(validator.validate(GenerationLocale.KO, "abcdefghijklmnopqrstuvwx"))
            .isEqualTo(AiLanguageValidationOutcome.KNOWN_MISMATCH);
        assertThat(validator.validate(GenerationLocale.EN, "abcdefghijklmnop"))
            .isEqualTo(AiLanguageValidationOutcome.MATCH);
        assertThat(validator.validate(GenerationLocale.EN, "가나다라마바사아자차카타"))
            .isEqualTo(AiLanguageValidationOutcome.KNOWN_MISMATCH);
        assertThat(validator.validate(GenerationLocale.KO, "abcdefghijklmnopqrstuvwx가"))
            .isEqualTo(AiLanguageValidationOutcome.UNKNOWN);
        assertThat(validator.validate(GenerationLocale.EN, "short"))
            .isEqualTo(AiLanguageValidationOutcome.UNKNOWN);
    }

    @Test
    void validatesDisplayUnitsSeparatelyInsteadOfHidingMismatchInMixedAggregate() {
        assertThat(validator.validateUnits(GenerationLocale.KO, List.of(
            "가나다라마바사아",
            "this independent display unit is clearly written in english"
        ))).isEqualTo(AiLanguageValidationOutcome.KNOWN_MISMATCH);
    }
}
