package cz.fit.cvut.seatlock.dto;

import cz.fit.cvut.seatlock.domain.enums.TicketStatus;
import cz.fit.cvut.seatlock.domain.enums.TicketType;
import java.util.UUID;

public record SeatMapTicket(
        UUID id,
        int seat,
        int row,
        TicketType type
) {
}
