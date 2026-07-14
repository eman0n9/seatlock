package cz.fit.cvut.seatlock.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class RegisterDTOValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsMalformedRegistration() {
        RegisterDTO input = new RegisterDTO(
                "not-an-email",
                "short",
                "",
                "",
                "420",
                "x"
        );

        assertFalse(validator.validate(input).isEmpty());
    }

    @Test
    void acceptsValidRegistration() {
        RegisterDTO input = new RegisterDTO(
                "user@example.com",
                "strong-password",
                "Test",
                "User",
                "+420",
                "123 456 789"
        );

        assertEquals(0, validator.validate(input).size());
    }
}
