package cz.fit.cvut.seatlock.domain;

import cz.fit.cvut.seatlock.domain.enums.TicketStatus;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Ticket {

    @EqualsAndHashCode.Include
    private UUID id;

    private TicketStatus status;

    private Order order;

    private Seat seat;

    private Offer offer;
}
