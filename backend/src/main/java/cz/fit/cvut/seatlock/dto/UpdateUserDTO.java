package cz.fit.cvut.seatlock.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateUserDTO(
        @Size(min = 1, max = 100)
        String name,
        @Size(min = 1, max = 100)
        String surname,
        @Email @Size(max = 254)
        String email,
        @Size(min = 8, max = 72)
        String password
) {
}
