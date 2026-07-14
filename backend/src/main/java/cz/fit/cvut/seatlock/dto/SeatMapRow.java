package cz.fit.cvut.seatlock.dto;

import java.util.List;

public record SeatMapRow(
        int number,
        List<SeatMapTicket> tickets
) {
}
