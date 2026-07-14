package cz.fit.cvut.seatlock.dto;

import java.util.UUID;

public record UserDTO(
        UUID id,
        String name,
        String surname,
        String email,
        String role,
        String phone
) {
}
