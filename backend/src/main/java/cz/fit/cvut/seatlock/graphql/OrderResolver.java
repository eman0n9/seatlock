package cz.fit.cvut.seatlock.graphql;

import cz.fit.cvut.seatlock.domain.Order;
import cz.fit.cvut.seatlock.dto.CheckoutResponse;
import cz.fit.cvut.seatlock.dto.OrderDTO;
import cz.fit.cvut.seatlock.security.SeatlockUserDetails;
import cz.fit.cvut.seatlock.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.SchemaMapping;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class OrderResolver {

    private final OrderService orderService;

    private UUID getCurrentUserId() {
        var principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof SeatlockUserDetails details) {
            return details.getId();
        }
        throw new RuntimeException("User not authenticated");
    }

    @QueryMapping
    public List<Order> getOrders() {
        return orderService.getOrdersByUserId(getCurrentUserId());
    }

    @QueryMapping
    public List<Order> getUpcomingOrders() {
        return orderService.getUpcomingOrdersByUserId(getCurrentUserId());
    }

    @QueryMapping
    public List<Order> getPastOrders() {
        return orderService.getPastOrdersByUserId(getCurrentUserId());
    }

    @QueryMapping
    public OrderDTO getOrderById(@Argument UUID id) {
        return orderService.getOrderById(id);
    }

    @MutationMapping
    public CheckoutResponse checkout(@Argument UUID activityId, @Argument List<UUID> seatIds) {
        return orderService.checkout(getCurrentUserId(), activityId, seatIds);
    }
}
