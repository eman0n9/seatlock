package cz.fit.cvut.seatlock.dto;

public record RegisterDTO(
        String email,
        String password,
        String name,
        String surname,
        String countryCode,
        String phoneNumber
) {
}
