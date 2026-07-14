package cz.fit.cvut.seatlock.dto;

import java.util.UUID;

public record OrderTicketDTO(
        UUID id,
        int seatNumber,
        int rowNumber
) {}
