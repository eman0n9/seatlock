package cz.fit.cvut.seatlock.events;

import java.util.List;
import java.util.UUID;

public record ActivityEventDTO(
        UUID activityId,
        String name,
        String description,
        List<String> performerNames
) {
}
