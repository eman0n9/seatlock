package cz.fit.cvut.seatlock.events;

import java.util.UUID;

public record PerformerEventDTO(
        UUID id,
        String name
) {
}
