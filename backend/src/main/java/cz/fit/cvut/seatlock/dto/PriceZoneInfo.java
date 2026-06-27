package cz.fit.cvut.seatlock.dto;

import cz.fit.cvut.seatlock.domain.enums.TicketType;

public record PriceZoneInfo(
    TicketType type,
    Double price
) {}
