package cz.fit.cvut.seatlock.dto;

import cz.fit.cvut.seatlock.domain.enums.Role;

public record UserDTO(
        String name,
        String surname,
        String email,
        String role,
        String phone
) {
}
