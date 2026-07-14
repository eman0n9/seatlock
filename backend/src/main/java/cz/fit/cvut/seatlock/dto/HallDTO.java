package cz.fit.cvut.seatlock.dto;

import java.util.List;

public record HallDTO(
        String name,
        String address,
        String city,
        List<RowConfig> seats
) {
}
