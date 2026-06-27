package cz.fit.cvut.seatlock.dto;

import java.util.List;

public record SeatMapResponse(
    List<SeatMapRow> rows,
    List<PriceZoneInfo> priceZones
) {}
