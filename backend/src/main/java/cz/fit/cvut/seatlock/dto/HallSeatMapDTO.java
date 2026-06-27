package cz.fit.cvut.seatlock.dto;

import java.util.List;

public record HallSeatMapDTO(
        List<HallRowDTO> rows
) {

}
