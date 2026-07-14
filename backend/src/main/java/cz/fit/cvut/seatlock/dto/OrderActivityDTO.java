package cz.fit.cvut.seatlock.dto;

import cz.fit.cvut.seatlock.domain.Hall;

public record OrderActivityDTO(
        String name,
        String date,
        String startTime,
        String endTime,
        String description,
        Hall hall
) {}
