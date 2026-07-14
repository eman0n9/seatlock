package cz.fit.cvut.seatlock.domain;

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
public class Seat {

    @EqualsAndHashCode.Include
    private UUID id;

    private Integer rowNumber;

    private Integer seatNumber;

    private Hall hall;

    private List<Ticket> tickets = new ArrayList<>();

    public Seat(int rowNumber, int seatNumber) {
        this.rowNumber = rowNumber;
        this.seatNumber = seatNumber;
    }
}
