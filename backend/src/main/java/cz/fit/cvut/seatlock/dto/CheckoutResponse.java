package cz.fit.cvut.seatlock.dto;

import java.util.List;
import java.util.UUID;

public record CheckoutResponse(
    UUID orderId,
    UUID activityId,
    List<UUID> purchasedSeatIds,
    Double totalPrice
) {}
