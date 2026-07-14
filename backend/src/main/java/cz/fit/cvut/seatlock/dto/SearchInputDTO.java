package cz.fit.cvut.seatlock.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record SearchInputDTO(
        String text,
        LocalDate date,
        LocalDate dateFrom,
        LocalDate dateTo,
        LocalTime startTime,
        String category,
        String city
) {
}
