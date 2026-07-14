package cz.fit.cvut.seatlock.graphql;

import cz.fit.cvut.seatlock.dto.CheckoutResponse;
import cz.fit.cvut.seatlock.dto.OrderDTO;
import cz.fit.cvut.seatlock.security.SeatlockUserDetails;
import cz.fit.cvut.seatlock.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class OrderResolver {

    private final OrderService orderService;

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public List<OrderDTO> getOrders(@AuthenticationPrincipal SeatlockUserDetails user) {
        return orderService.getOrdersByUserId(user.getId());
    }

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public List<OrderDTO> getUpcomingOrders(@AuthenticationPrincipal SeatlockUserDetails user) {
        return orderService.getUpcomingOrdersByUserId(user.getId());
    }

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public List<OrderDTO> getPastOrders(@AuthenticationPrincipal SeatlockUserDetails user) {
        return orderService.getPastOrdersByUserId(user.getId());
    }

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public OrderDTO getOrderById(
            @Argument UUID id,
            @AuthenticationPrincipal SeatlockUserDetails user
    ) {
        return orderService.getOrderById(id, user.getId(), isAdmin(user));
    }

    @MutationMapping
    @PreAuthorize("isAuthenticated()")
    public CheckoutResponse checkout(
            @Argument UUID activityId,
            @Argument List<UUID> seatIds,
            @AuthenticationPrincipal SeatlockUserDetails user
    ) {
        return orderService.checkout(user.getId(), activityId, seatIds);
    }

    @MutationMapping
    @PreAuthorize("isAuthenticated()")
    public Boolean releaseReservations(
            @Argument UUID activityId,
            @Argument List<UUID> seatIds,
            @AuthenticationPrincipal SeatlockUserDetails user
    ) {
        return orderService.releaseReservations(user.getId(), activityId, seatIds);
    }

    private boolean isAdmin(SeatlockUserDetails user) {
        return user.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
