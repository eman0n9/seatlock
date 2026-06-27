package cz.fit.cvut.seatlock.domain;

import cz.fit.cvut.seatlock.domain.enums.TicketType;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Offer {

    @EqualsAndHashCode.Include
    private UUID id;

    private TicketType type;

    private Double price;

    private Activity activity;

    private List<Seat> seats = new ArrayList<>();

    private List<Ticket> tickets = new ArrayList<>();
}
