package cz.fit.cvut.seatlock.dto;

import java.util.List;
import java.util.UUID;

public record OrderDTO(
        UUID id,
        Double totalPrice,
        String status,
        String createdAt,
        List<OrderTicketDTO> tickets,
        OrderActivityDTO activity
) {}
