package cz.fit.cvut.seatlock.dto;

public record UpdateUserDTO(
        String name,
        String surname,
        String email,
        String password
) {
}
