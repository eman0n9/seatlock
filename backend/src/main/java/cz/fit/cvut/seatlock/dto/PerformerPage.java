package cz.fit.cvut.seatlock.dto;

import cz.fit.cvut.seatlock.domain.Performer;

import java.util.List;

public record PerformerPage(
        List<Performer> content,
        long totalElements,
        int totalPages,
        int pageNumber
) {
}
