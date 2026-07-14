package cz.fit.cvut.seatlock.dto;

import cz.fit.cvut.seatlock.domain.Activity;

import java.util.List;

public record ActivityPage(
        List<Activity> content,
        long totalElements,
        int totalPages,
        int pageNumber
) {
}
