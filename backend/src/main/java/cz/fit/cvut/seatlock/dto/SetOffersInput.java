package cz.fit.cvut.seatlock.dto;

import java.util.List;

public record SetOffersInput(
        List<TicketTypeInput> types,
        List<RowOfferInput> offers
) {}
