package cz.fit.cvut.seatlock.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record ActivityDTO(
        String name,
        LocalDate date,
        LocalTime startTime,
        LocalTime endTime,
        String description,
        UUID categoryId,
        UUID hallId,
        List<UUID> performer,
        List<PriceZoneDTO> priceZones
) {
}
