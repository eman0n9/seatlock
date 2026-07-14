package cz.fit.cvut.seatlock.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterDTO(
        @NotBlank @Email @Size(max = 254)
        String email,
        @NotBlank @Size(min = 8, max = 72)
        String password,
        @NotBlank @Size(max = 100)
        String name,
        @NotBlank @Size(max = 100)
        String surname,
        @NotBlank @Pattern(regexp = "^\\+[1-9]\\d{0,3}$")
        String countryCode,
        @NotBlank @Pattern(regexp = "^[0-9][0-9 ()-]{4,29}$")
        String phoneNumber
) {
}
