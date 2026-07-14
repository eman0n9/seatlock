package cz.fit.cvut.seatlock.domain;

import cz.fit.cvut.seatlock.domain.enums.OrderStatus;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Order {

    @EqualsAndHashCode.Include
    private UUID id;

    private Double totalPrice;

    private OrderStatus status;

    private LocalDateTime createdAt;

    private User user;

    private List<Ticket> tickets = new ArrayList<>();
}
