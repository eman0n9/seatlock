package cz.fit.cvut.seatlock.dto;

import cz.fit.cvut.seatlock.domain.enums.TicketType;
import java.util.List;
import java.util.UUID;

public record PriceZoneDTO(
        TicketType ticketType,
        Double price,
        List<UUID> seatIds
) {
}
