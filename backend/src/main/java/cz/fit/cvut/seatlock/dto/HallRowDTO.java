package cz.fit.cvut.seatlock.dto;

import java.util.List;

public record HallRowDTO(
        int number,
        List<HallSeatDTO> seats
) {

}
