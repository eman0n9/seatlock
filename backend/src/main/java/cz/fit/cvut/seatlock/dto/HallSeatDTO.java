package cz.fit.cvut.seatlock.dto;

import java.util.UUID;

public record HallSeatDTO(
        UUID id,
        int seatNumber,
        int rowNumber
) {

}
